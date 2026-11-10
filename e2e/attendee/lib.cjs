// Shared helpers for the attendee / guest end-to-end scripts.
// Every script: one headless browser at a time, closed at the end; all data it creates
// uses the e2e-att- prefix and is removed by cleanup.cjs.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.env.EVENTFLOW_ROOT || 'D:/eventflow';
const puppeteer = require(ROOT + '/node_modules/puppeteer-core');
const { PrismaClient } = require(ROOT + '/node_modules/@prisma/client');
const bcrypt = require(ROOT + '/node_modules/bcryptjs');

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), 'eventflow-e2e-attendee');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PREFIX = 'e2e-att-';
const PASS = 'E2eAtt@12345';
const DEMO_PASS = 'Test@12345';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true };

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
  if (!m) throw new Error('DATABASE_URL not found in .env');
  return m[1];
}
const db = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(fs.existsSync);

// ---------- results ----------
function suite(name) {
  const results = [];
  let area = 'general';
  const s = {
    name,
    results,
    area(a) { area = a; console.log(`\n== ${a}`); },
    check(label, ok, detail = '') {
      const r = { area, label, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) };
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${label}${r.detail ? '  -- ' + r.detail.slice(0, 300) : ''}`);
      return r.ok;
    },
    note(label, detail = '') { results.push({ area, label, ok: null, detail: String(detail) }); console.log(`NOTE  ${label}${detail ? '  -- ' + String(detail).slice(0, 300) : ''}`); },
    async step(label, fn) {
      try { return await fn(); } catch (e) { s.check(label, false, 'threw: ' + (e && e.message ? e.message.split('\n')[0] : e)); return undefined; }
    },
    finish() {
      const file = path.join(OUT, `${name}-results.json`);
      fs.writeFileSync(file, JSON.stringify(results, null, 1));
      const pass = results.filter(r => r.ok === true).length, fail = results.filter(r => r.ok === false).length;
      console.log(`\n${name}: ${pass} passed, ${fail} failed  -> ${file}`);
      for (const r of results.filter(r => r.ok === false)) console.log(`  FAIL [${r.area}] ${r.label} ${r.detail ? '-- ' + r.detail.slice(0, 200) : ''}`);
      return fail;
    },
  };
  return s;
}

// ---------- created-data registry (cleanup also sweeps by prefix) ----------
const REGISTRY = path.join(OUT, 'created.json');
function track(kind, value) {
  const reg = fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) : {};
  reg[kind] = Array.from(new Set([...(reg[kind] || []), value]));
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 1));
}

// Starting values of every counter these scripts can move. Written once (first run) and
// compared by cleanup.cjs after it has removed the test registrations.
const COUNTERS = path.join(OUT, 'counters.json');
const TOUCHED_SLUGS = ['ai-in-production-talk', 'carnatic-evening', 'rust-systems-workshop', 'utsav-2026', 'tech-club-orientation', 'hack-the-monsoon-2026'];
async function snapshotCounters() {
  if (fs.existsSync(COUNTERS)) return JSON.parse(fs.readFileSync(COUNTERS, 'utf8'));
  const snap = await readCounters();
  fs.writeFileSync(COUNTERS, JSON.stringify(snap, null, 1));
  return snap;
}
async function readCounters() {
  const evs = await db.event.findMany({ where: { slug: { in: TOUCHED_SLUGS } }, select: { id: true, slug: true, currentRegistrations: true, ticketTypes: { select: { id: true, name: true, sold: true } }, coupons: { select: { id: true, code: true, currentUses: true } } } });
  const snap = {};
  for (const e of evs) snap[e.slug] = { id: e.id, currentRegistrations: e.currentRegistrations, ticketTypes: Object.fromEntries(e.ticketTypes.map(t => [t.id, { name: t.name, sold: t.sold }])), coupons: Object.fromEntries(e.coupons.map(c => [c.id, { code: c.code, currentUses: c.currentUses }])) };
  return snap;
}

// ---------- accounts ----------
async function ensureUser(email, name, opts = {}) {
  email = email.toLowerCase();
  if (!email.startsWith(PREFIX)) throw new Error('refusing to touch a non-test account: ' + email);
  let u = await db.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(opts.password || PASS, 10);
  if (!u) u = await db.user.create({ data: { email, name, passwordHash, emailVerified: new Date(), role: 'USER', collegeName: 'E2E Test College' } });
  else u = await db.user.update({ where: { id: u.id }, data: { passwordHash, emailVerified: u.emailVerified || new Date(), isActive: true, isBanned: false, metadata: undefined } });
  track('users', email);
  return u;
}
// Deletes e2e-att- users (and, by cascade, their registrations, tickets, payments,
// notifications, OTPs, certificates, saved events, audit rows). Before that it gives back
// whatever their registrations still hold, using the app's own rules
// (src/lib/registration-capacity.ts): an event seat while the status counts or a payment
// hold is active, ticket stock until metadata.stockReleasedAt, a coupon use until
// metadata.couponReleasedAt. Registrations inserted directly by a test carry
// metadata.e2eNoClaims and give nothing back.
const COUNTED = ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN', 'NO_SHOW'];
async function purgeUsers(emails) {
  const list = (Array.isArray(emails) ? emails : [emails]).map(e => e.toLowerCase());
  if (list.some(e => !e.startsWith(PREFIX))) throw new Error('refusing to purge non-test accounts');
  const users = await db.user.findMany({ where: { email: { in: list } }, select: { id: true, email: true } });
  const log = [];
  for (const u of users) {
    const regs = await db.registration.findMany({ where: { userId: u.id }, include: { payment: { select: { couponId: true } }, event: { select: { slug: true } } } });
    for (const r of regs) {
      const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
      if (meta.e2eNoClaims) continue;
      const q = Number.isInteger(Number(meta.ticketQuantity)) && Number(meta.ticketQuantity) > 0 ? Number(meta.ticketQuantity) : 1;
      const seat = COUNTED.includes(r.status) || (r.status === 'PENDING' && typeof meta.holdExpiresAt === 'string' && !meta.holdReleasedAt);
      await db.$transaction(async tx => {
        if (seat) await tx.event.updateMany({ where: { id: r.eventId, currentRegistrations: { gt: 0 } }, data: { currentRegistrations: { decrement: 1 } } });
        if (!meta.stockReleasedAt) await tx.ticketType.updateMany({ where: { id: r.ticketTypeId, sold: { gte: q } }, data: { sold: { decrement: q } } });
        if (r.payment?.couponId && !meta.couponReleasedAt) await tx.coupon.updateMany({ where: { id: r.payment.couponId, currentUses: { gt: 0 } }, data: { currentUses: { decrement: 1 } } });
      });
      log.push(`${u.email} ${r.event.slug} ${r.status}${seat ? ' -seat' : ''}${!meta.stockReleasedAt ? ' -stock' : ''}`);
    }
    await db.notification.deleteMany({ where: { OR: [{ userId: u.id }, { message: { contains: u.email } }] } });
    await db.auditLog.deleteMany({ where: { OR: [{ userId: u.id }, { description: { contains: u.email } }] } });
  }
  if (users.length) await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  return log;
}

async function idOf(slug) { return (await db.event.findUnique({ where: { slug }, select: { id: true } })).id; }
async function orgIdOf(slug) { return (await db.organization.findUnique({ where: { slug }, select: { id: true } })).id; }

// ---------- browser ----------
async function launch(extraArgs = []) {
  if (!CHROME) throw new Error('No Chrome/Edge found; set CHROME_PATH');
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu', '--disable-dev-shm-usage', ...extraArgs] });
}

// A fresh incognito context = a separate person. Collects console errors.
async function person(browser, { viewport = DESKTOP, theme = 'light' } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ deviceScaleFactor: 1, ...viewport });
  if (theme) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  page.setDefaultTimeout(45000);
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text().slice(0, 240)); });
  page.on('pageerror', e => page.errors.push('pageerror: ' + String(e.message).slice(0, 240)));
  page.ctx = ctx;
  return page;
}

// Another tester may switch the platform into maintenance mode for a minute: wait it out
// (up to ~4 min) instead of reporting every page as broken.
async function maintenanceOn() {
  try { const r = await fetch(BASE + '/events', { signal: AbortSignal.timeout(30000) }); return r.status === 503; } catch { return false; }
}
async function waitMaintenance() {
  for (let i = 0; i < 16 && await maintenanceOn(); i++) { console.log('  (maintenance mode is on -- waiting 15s)'); await sleep(15000); }
}
async function go(page, p, opts = {}) {
  let res;
  for (let i = 0; i < 3; i++) {
    res = await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 90000, ...opts });
    if (!res || res.status() !== 503 || !(await maintenanceOn())) break;
    await waitMaintenance();
  }
  await sleep(opts.settle ?? 600);
  return res ? res.status() : 0;
}

// Sign in through the Auth.js credentials endpoint (what the login form does)
async function loginApi(page, email, password = PASS) {
  if (!page.url().startsWith(BASE)) await page.goto(BASE + '/api/auth/csrf');
  return page.evaluate(async ([email, password]) => {
    const { csrfToken } = await (await fetch('/api/auth/csrf')).json();
    const r = await fetch('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, email, password, json: 'true' }), redirect: 'manual' });
    const s = await (await fetch('/api/auth/session')).json();
    return s?.user?.email || null;
  }, [email, password]);
}
async function logoutApi(page) {
  await page.evaluate(async () => {
    const { csrfToken } = await (await fetch('/api/auth/csrf')).json();
    await fetch('/api/auth/signout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, json: 'true' }) });
  });
}

// fetch() from inside the page (carries that person's session cookie)
async function api(page, method, url, body) {
  if (!page.url().startsWith(BASE)) await page.goto(BASE + '/api/health');
  for (let i = 0; i < 2; i++) {
    const r = await apiOnce(page, method, url, body);
    // Our API routes answer 404 with JSON. A 404 *HTML page* for an /api/ route means the dev
    // server lost its route table (seen after a memory-limit restart): stop instead of
    // reporting app bugs that aren't there.
    if (r.status === 404 && r.ct.includes('text/html') && url.startsWith('/api/')) throw new Error('ENVIRONMENT: dev server returned its 404 page for ' + method + ' ' + url + ' (route table broken; restart the dev server and re-run)');
    if (r.status !== 503 || !(await maintenanceOn())) return r;
    await waitMaintenance();
  }
  return apiOnce(page, method, url, body);
}
async function apiOnce(page, method, url, body) {
  return page.evaluate(async ([method, url, body]) => {
    const has = body !== undefined && body !== null;
    const r = await fetch(url, { method, headers: has ? { "Content-Type": "application/json" } : {}, body: has ? JSON.stringify(body) : undefined, redirect: "manual" });
    const ct = r.headers.get('content-type') || '';
    const cd = r.headers.get('content-disposition') || '';
    let json = null, text = '', head = '', size = 0;
    if (ct.includes('json')) { try { json = await r.json(); } catch { } }
    else { const buf = new Uint8Array(await r.arrayBuffer()); size = buf.length; head = String.fromCharCode(...buf.slice(0, 16)); if (!/pdf|png|octet/.test(ct)) text = new TextDecoder().decode(buf).slice(0, 4000); }
    return { status: r.status, ct, cd, json, text, head, size };
  }, [method, url, body === undefined ? null : body]);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(SHOTS, name.replace(/[^a-z0-9-_]+/gi, '_') + '.png');
  try { await page.screenshot({ path: file, fullPage: true, captureBeyondViewport: true }); } catch { }
  return file;
}

async function bodyText(page) { return page.evaluate(() => document.body.innerText); }
async function waitText(page, re, timeout = 20000) {
  const src = re instanceof RegExp ? re.source : re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = re instanceof RegExp ? re.flags : 'i';
  try {
    await page.waitForFunction((s, f) => new RegExp(s, f).test(document.body.innerText), { timeout, polling: 250 }, src, flags);
    return true;
  } catch { return false; }
}
// Click the first visible button/link whose text matches
async function clickText(page, re, sel = 'button, a, [role=button], [role=tab], label') {
  const src = re instanceof RegExp ? re.source : re;
  const flags = re instanceof RegExp ? re.flags : 'i';
  const ok = await page.evaluate((sel, s, f) => {
    const rx = new RegExp(s, f);
    const els = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[aria-hidden=true],[inert]'); });
    const el = els.find(e => rx.test((e.getAttribute('aria-label') || '').trim())) || els.find(e => rx.test((e.innerText || '').trim()));
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, sel, src, flags);
  return ok;
}
async function typeInto(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.focus(selector);
    await page.evaluate(sel => { const el = document.querySelector(sel); if (el && el.select) el.select(); }, selector);
    await page.keyboard.press('Backspace');
    await page.type(selector, value, { delay: 5 });
    const v = await page.$eval(selector, el => el.value);
    if (v === value) return true;
    await sleep(500); // the step may still be animating in / hydrating
  }
  return false;
}
// Toasts (sonner) currently on screen
async function toasts(page) { return page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.replace(/\s+/g, ' ').trim())); }
async function overflowX(page) { return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }

async function latestOtp(email, purpose) {
  const o = await db.oTP.findFirst({ where: { email: email.toLowerCase(), purpose, isUsed: false }, orderBy: { createdAt: 'desc' } });
  return o ? o.code : null;
}

async function serverUp() {
  try { const r = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(30000) }); return r.ok; } catch { return false; }
}

module.exports = {
  ROOT, BASE, OUT, SHOTS, PREFIX, PASS, DEMO_PASS, DESKTOP, PHONE, db, bcrypt, suite, track, snapshotCounters, readCounters, TOUCHED_SLUGS,
  ensureUser, purgeUsers, idOf, orgIdOf, launch, person, go, loginApi, logoutApi, api, sleep, shot, bodyText, waitText, clickText, typeInto, toasts, overflowX, latestOtp, serverUp, waitMaintenance,
};
