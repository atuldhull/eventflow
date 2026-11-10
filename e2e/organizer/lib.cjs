// Shared helpers for the organizer / door-volunteer end-to-end scripts.
// One headless browser at a time (the scripts launch and close their own); state that
// later scripts need (ids of what was created) lives in OUT/state.json, results in OUT/results.
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = 'D:/eventflow'
const puppeteer = require(ROOT + '/node_modules/puppeteer-core')
const { PrismaClient } = require(ROOT + '/node_modules/@prisma/client')

const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), 'eventflow-e2e-organizer')
const STATE_FILE = path.join(OUT, 'state.json')
const TITLE_PREFIX = 'E2E-ORG'
const EMAIL_PREFIX = 'e2e-org-'
const PASSWORD = 'E2e-Org-Pass1!'
const ORG_SLUG = 'tech-club'
const OTHER_ORG_SLUG = 'cultural-society'
const USERS = {
  alice: { email: 'alice@test.local', password: 'Test@12345' },
  bob: { email: 'bob@test.local', password: 'Test@12345' },
}
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))

for (const d of [OUT, path.join(OUT, 'shots'), path.join(OUT, 'results'), path.join(OUT, 'downloads')]) fs.mkdirSync(d, { recursive: true })

function envVar(name) {
  const txt = fs.readFileSync(ROOT + '/.env', 'utf8')
  const m = txt.match(new RegExp('^' + name + '\\s*=\\s*"?([^"\\r\\n]*)"?', 'm'))
  return m ? m[1] : undefined
}

let _db
function db() {
  if (!_db) _db = new PrismaClient({ datasources: { db: { url: envVar('DATABASE_URL') } } })
  return _db
}

// ---------- state (ids of everything created, shared between scripts) ----------
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { return null }
}
function state() {
  let s = loadState()
  if (!s) {
    s = { runId: Date.now().toString(36).slice(-5), startedAt: new Date().toISOString(), created: {}, snapshot: {} }
    saveState(s)
  }
  return s
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)) }
/** Records an id (or any value) under created[kind]; saved immediately. */
function track(kind, id) {
  const s = state()
  s.created[kind] = s.created[kind] || []
  if (!s.created[kind].includes(id)) s.created[kind].push(id)
  saveState(s)
}
function setState(key, value) { const s = state(); s[key] = value; saveState(s) }

// ---------- results ----------
function tester(name) {
  const results = []
  const ux = []
  const started = Date.now()
  const log = (line) => console.log(line)
  return {
    name,
    results,
    ux,
    ok(label, cond, detail) {
      results.push({ label, pass: !!cond, detail: detail === undefined ? null : detail })
      log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined && !cond ? `  -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
      return !!cond
    },
    info(line) { log(`      ${line}`) },
    /** Runs one step; an exception is recorded as a FAIL and the script carries on. */
    async step(label, fn) {
      await waitWhileMaintenance()
      try { return await fn() } catch (e) {
        results.push({ label: `${label} (threw)`, pass: false, detail: String(e && e.stack || e).slice(0, 600) })
        log(`FAIL  ${label} threw: ${String(e && e.message || e).slice(0, 300)}`)
        return undefined
      }
    },
    uxIssue(severity, page, problem, fix) { ux.push({ severity, page, problem, fix }) },
    finish() {
      const pass = results.filter((r) => r.pass).length
      const fail = results.length - pass
      const file = path.join(OUT, 'results', `${name}.json`)
      fs.writeFileSync(file, JSON.stringify({ name, pass, fail, seconds: Math.round((Date.now() - started) / 1000), results, ux }, null, 2))
      log(`\n${name}: ${pass} passed, ${fail} failed (${Math.round((Date.now() - started) / 1000)}s). Results: ${file}`)
      return { pass, fail }
    },
  }
}

// ---------- server ----------
async function ensureServer() {
  for (let i = 0; i < 3; i++) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 30000)
      const r = await fetch(BASE + '/api/health', { signal: ctl.signal })
      clearTimeout(t)
      if (r.status < 500) return true
    } catch {}
  }
  throw new Error(`The dev server at ${BASE} is not responding: stop and report.`)
}

/** Another tester may switch maintenance mode on for a minute: wait it out (max 5 min). */
async function waitWhileMaintenance() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(BASE + '/api/events?limit=1')
      if (r.status !== 503) return true
      const j = await r.json().catch(() => ({}))
      if (!j.maintenance) return true
      if (i === 0) console.log('      (maintenance mode is on: waiting)')
    } catch {}
    await new Promise((res) => setTimeout(res, 10000))
  }
  return false
}

// ---------- browser ----------
async function launch() {
  if (!BROWSER) throw new Error('No Chrome/Edge found')
  return puppeteer.launch({
    executablePath: BROWSER,
    headless: true,
    args: ['--no-first-run', '--disable-gpu', '--disable-extensions', '--js-flags=--max-old-space-size=512'],
    protocolTimeout: 180000,
  })
}

const PHONE = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false }

/**
 * A fresh signed-in context. Records sonner toasts in window.__toasts and console errors in
 * page.__errors. `user` is a key of USERS or { email, password }; null stays signed out.
 */
async function session(browser, user, viewport = DESKTOP, opts = {}) {
  await waitWhileMaintenance()
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)
  page.setDefaultNavigationTimeout(90000)
  await page.setViewport(viewport)
  if (opts.timezone) await page.emulateTimezone(opts.timezone)
  page.__errors = []
  page.on('console', (m) => { if (m.type() === 'error') page.__errors.push(m.text().slice(0, 300)) })
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + String(e.message).slice(0, 300)))
  await page.evaluateOnNewDocument(() => {
    window.__toasts = []
    const last = new WeakMap() // element -> text already recorded (sonner may reuse nodes)
    const scan = () => document.querySelectorAll('[data-sonner-toast]').forEach((el) => {
      const text = (el.innerText || '').trim()
      if (!text || last.get(el) === text) return
      last.set(el, text)
      const ig = window.__toastIgnore
      if (ig && Date.now() < ig.until && ig.texts.includes(text)) return
      window.__toasts.push({ type: el.getAttribute('data-type'), text, at: Date.now() })
    })
    const start = () => new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
    if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start)
  })
  const creds = typeof user === 'string' ? USERS[user] : user
  if (!creds) await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded' })
  if (creds) {
    await page.goto(BASE + '/api/auth/csrf', { waitUntil: 'domcontentloaded' })
    const who = await page.evaluate(async ({ email, password }) => {
      const { csrfToken } = await (await fetch('/api/auth/csrf')).json()
      await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrfToken, email, password, json: 'true' }),
      })
      return (await (await fetch('/api/auth/session')).json())?.user?.email
    }, creds)
    if (who !== creds.email) throw new Error(`Login failed for ${creds.email} (got ${who})`)
  }
  page.__ctx = ctx
  return page
}

async function closeSession(page) { try { await page.__ctx.close() } catch {} }

async function goto(page, p, waitUntil = 'networkidle2') {
  for (let i = 0; ; i++) {
    const r = await page.goto(BASE + p, { waitUntil, timeout: 120000 })
    const st = r ? r.status() : 0
    if (st === 503 && i < 20 && /right back/i.test(await page.evaluate(() => document.body.innerText))) { await sleep(10000); continue }
    return st
  }
}

/** fetch() inside the page (cookies included). Returns { status, json, text, headers }. */
async function api(page, method, url, body, extraHeaders) {
  for (let i = 0; i < 20; i++) {
    const r = await apiOnce(page, method, url, body, extraHeaders)
    if (!(r.status === 503 && r.json && r.json.maintenance)) return r
    await sleep(10000)
  }
  return apiOnce(page, method, url, body, extraHeaders)
}
async function apiOnce(page, method, url, body, extraHeaders) {
  return page.evaluate(async ({ method, url, body, extraHeaders }) => {
    const init = { method, headers: { ...(extraHeaders || {}) } }
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body) }
    const r = await fetch(url, init)
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: r.status, json, text: json ? null : text.slice(0, 200000), headers: { type: r.headers.get('content-type'), disposition: r.headers.get('content-disposition') } }
  }, { method, url, body, extraHeaders })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function toasts(page) { return page.evaluate(() => window.__toasts || []) }
async function clearToasts(page) {
  await page.evaluate(() => {
    // toasts still on screen may be re-mounted by sonner: ignore their text from now on
    window.__toastIgnore = { texts: [...document.querySelectorAll('[data-sonner-toast]')].map((el) => (el.innerText || '').trim()), until: Date.now() + 6000 }
    window.__toasts = []
  })
}
/** Waits for a new toast (after the last clearToasts) and returns its text, or null. */
async function waitToast(page, timeout = 15000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const t = await toasts(page)
    if (t.length) return t[t.length - 1]
    await sleep(200)
  }
  return null
}

/** Waits until no toast is on screen (toasts sit over the sticky footer buttons). */
async function waitNoToast(page, timeout = 10000) {
  try { await page.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), { timeout }) } catch {}
}

/** Visible elements matching `selector` whose text contains `text` (string or RegExp). */
async function findByText(page, selector, text, { exact = false, timeout = 15000 } = {}) {
  const end = Date.now() + timeout
  const src = text instanceof RegExp ? { re: text.source, flags: text.flags } : { s: text }
  while (true) {
    const handle = await page.evaluateHandle(({ selector, src, exact }) => {
      const match = (t) => {
        t = (t || '').replace(/\s+/g, ' ').trim()
        if (src.re) return new RegExp(src.re, src.flags).test(t)
        return exact ? t === src.s : t.includes(src.s)
      }
      const els = [...document.querySelectorAll(selector)].filter((el) => {
        const r = el.getBoundingClientRect()
        const st = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'
      })
      // innermost match wins (a button inside a matching list item)
      const hits = els.filter((el) => match(el.innerText || el.textContent || el.getAttribute('aria-label') || ''))
      return hits.find((el) => !hits.some((o) => o !== el && el.contains(o))) || null
    }, { selector, src, exact })
    const el = handle.asElement()
    if (el) return el
    await handle.dispose()
    if (Date.now() > end) return null
    await sleep(250)
  }
}

async function clickText(page, text, selector = 'button, a, [role="menuitem"], [role="tab"], [role="option"], [role="radio"]', opts) {
  const el = await findByText(page, selector, text, opts)
  if (!el) throw new Error(`No clickable "${text}" (${selector})`)
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await el.click()
  return el
}

/** Sets an input/textarea value the way React notices (native setter + input/change). */
async function setValue(page, selector, value) {
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }, value)
}

/** Types like a person (clears first). */
async function typeInto(page, selector, value) {
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center' }))
  await page.click(selector, { clickCount: 3 })
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(selector, value, { delay: 5 })
}

/** Base UI Select: open the trigger, pick the option with this text. */
async function selectOption(page, triggerSelector, optionText) {
  await page.waitForSelector(triggerSelector, { visible: true })
  await page.$eval(triggerSelector, (e) => e.scrollIntoView({ block: 'center' }))
  await page.click(triggerSelector)
  const opt = await findByText(page, '[role="option"]', optionText, { exact: true, timeout: 8000 })
    || await findByText(page, '[role="option"]', optionText, { timeout: 2000 })
  if (!opt) throw new Error(`Option "${optionText}" not found for ${triggerSelector}`)
  await opt.click()
  await sleep(250)
}

/** Base UI Switch by aria-label or selector; sets it to `on`. Returns the final state. */
async function setSwitch(page, labelOrSelector, on) {
  const sel = labelOrSelector.startsWith('#') || labelOrSelector.startsWith('[') ? labelOrSelector : `[role="switch"][aria-label="${labelOrSelector}"]`
  await page.waitForSelector(sel)
  // Base UI puts an id on the hidden <input>; the visible control is the role=switch next to it
  const target = async () => page.evaluateHandle((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    if (el.getAttribute('role') === 'switch') return el
    return el.parentElement?.querySelector('[role="switch"]') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el
  }, sel)
  const isOn = async () => page.$eval(sel, (e) => {
    const sw = e.getAttribute('role') === 'switch' ? e : e.parentElement?.querySelector('[role="switch"]')
    if (sw) return sw.getAttribute('aria-checked') === 'true' || sw.hasAttribute('data-checked')
    return !!e.checked
  })
  if ((await isOn()) !== on) {
    const t = (await target()).asElement()
    await t.evaluate((e) => e.scrollIntoView({ block: 'center' }))
    await t.click()
    await sleep(250)
  }
  return isOn()
}

async function bodyText(page) { return page.evaluate(() => document.body.innerText) }
async function waitText(page, text, timeout = 20000) {
  try {
    await page.waitForFunction((t) => document.body && document.body.innerText.includes(t), { timeout }, text)
    return true
  } catch { return false }
}
async function waitGone(page, text, timeout = 20000) {
  try {
    await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout }, text)
    return true
  } catch { return false }
}

async function shot(page, name) {
  const file = path.join(OUT, 'shots', `${name}.png`)
  try { await page.screenshot({ path: file, fullPage: false }) } catch {}
  return file
}

/** Horizontal overflow at the current width (a phone layout problem). */
async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/** Small elements a thumb would miss (visible buttons/links under 32px high). */
async function smallTargets(page, min = 32) {
  return page.evaluate((min) => [...document.querySelectorAll('main button, main a, main [role="switch"]')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < min })
    .map((e) => (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 40)), min)
}

// ---------- data helpers ----------
async function orgIds() {
  const [org, other] = await Promise.all([
    db().organization.findUnique({ where: { slug: ORG_SLUG }, select: { id: true, enterpriseId: true } }),
    db().organization.findUnique({ where: { slug: OTHER_ORG_SLUG }, select: { id: true } }),
  ])
  const alice = await db().user.findUnique({ where: { email: USERS.alice.email }, select: { id: true } })
  return { orgId: org.id, enterpriseId: org.enterpriseId, otherOrgId: other.id, aliceId: alice.id }
}

/** Remembers Tech Club's settings JSON and profile fields once, so cleanup can put them back. */
async function snapshotOrg() {
  const s = state()
  if (s.snapshot && 'orgSettings' in s.snapshot) return s.snapshot
  const org = await db().organization.findUnique({ where: { slug: ORG_SLUG } })
  s.snapshot = s.snapshot || {}
  s.snapshot.orgSettings = org.settings ?? null
  s.snapshot.orgFields = { name: org.name, description: org.description, email: org.email, phone: org.phone, website: org.website, address: org.address, city: org.city, state: org.state, category: org.category }
  saveState(s)
  return s.snapshot
}

/** Signs up an e2e attendee through the real API and verifies the email with the OTP from the DB. */
async function createAttendee(page, key, name) {
  const email = `${EMAIL_PREFIX}${key}-${state().runId}@test.local`
  const existing = await db().user.findUnique({ where: { email }, select: { id: true, emailVerified: true } })
  if (existing?.emailVerified) { track('users', email); return { email, password: PASSWORD, id: existing.id } }
  const r = await api(page, 'POST', '/api/auth/signup', { name, email, password: PASSWORD, confirmPassword: PASSWORD, agreeToTerms: true })
  if (r.status >= 300) throw new Error(`signup ${email}: ${r.status} ${JSON.stringify(r.json)}`)
  track('users', email)
  const otp = await db().oTP.findFirst({ where: { email, isUsed: false }, orderBy: { createdAt: 'desc' } })
  const v = await api(page, 'POST', '/api/auth/verify-email', { email, otp: otp.code })
  if (v.status >= 300) throw new Error(`verify ${email}: ${v.status} ${JSON.stringify(v.json)}`)
  const u = await db().user.findUnique({ where: { email }, select: { id: true } })
  return { email, password: PASSWORD, id: u.id }
}

/** A real 64x36 PNG (solid colour), written to OUT. */
function makePng() {
  const zlib = require('zlib')
  const w = 64, h = 36
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 30 + x * 3; raw[o + 1] = 90; raw[o + 2] = 200 - y * 3 }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
  const file = path.join(OUT, 'e2e-org-cover.png')
  fs.writeFileSync(file, png)
  return file
}

/** Runs a script body with one browser, always closing it and the DB. */
async function run(name, body) {
  const T = tester(name)
  let browser
  try {
    await ensureServer()
    browser = await launch()
    await body(T, browser)
  } catch (e) {
    T.ok(`${name} aborted`, false, String(e && e.stack || e).slice(0, 800))
  } finally {
    if (browser) await browser.close().catch(() => {})
    const r = T.finish()
    if (_db) await _db.$disconnect()
    process.exitCode = r.fail ? 1 : 0
  }
}

module.exports = {
  ROOT, BASE, OUT, TITLE_PREFIX, EMAIL_PREFIX, PASSWORD, USERS, PHONE, DESKTOP, ORG_SLUG,
  db, waitWhileMaintenance, state, saveState, setState, track, loadState, snapshotOrg, tester, ensureServer, launch, session, closeSession, goto, api, sleep,
  toasts, clearToasts, waitToast, waitNoToast, findByText, clickText, setValue, typeInto, selectOption, setSwitch,
  bodyText, waitText, waitGone, shot, overflowX, smallTargets, orgIds, createAttendee, makePng, run,
}
