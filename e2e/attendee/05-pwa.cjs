// PWA + dark mode spot checks: manifest and icons, <head> links, service worker, and the
// tickets page working offline. public/sw.js disables itself on localhost/127.0.0.1 (dev
// safety), so the offline part runs Chrome against an alias host (e2e-pwa.test -> 127.0.0.1)
// that Chrome is told to treat as a secure origin. Offline means the page AND the service
// worker are cut off. Against `next dev`, a page served from the SW cache can't hydrate
// (React debug channel), so the cold-open content checks become NOTEs there and are real
// checks against `next start`.
// Run: node e2e/attendee/05-pwa.cjs
const L = require('./lib.cjs');
const { db, BASE } = L;
const S = L.suite('05-pwa');
const U = 'e2e-att-pwa@test.local';
const ALIAS = 'http://e2e-pwa.test:' + (new URL(BASE).port || '80');


(async () => {
  if (!(await L.serverUp())) { console.error('Server not responding at ' + BASE); process.exit(2); }
  await L.snapshotCounters();
  await L.purgeUsers([U]);
  const user = await L.ensureUser(U, 'E2E-ATT PWA');
  let browser = await L.launch();
  try {
    S.area('PWA: manifest, icons, head');
    const p = await L.person(browser, { viewport: L.PHONE });
    await L.go(p, '/', { settle: 800 });
    const head = await p.evaluate(() => ({
      manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
      theme: [...document.querySelectorAll('meta[name=theme-color]')].map(m => m.content + (m.media ? ' ' + m.media : '')),
      apple: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
      viewport: document.querySelector('meta[name=viewport]')?.content,
    }));
    S.check('<head> links the manifest', !!head.manifest, JSON.stringify(head));
    S.check('<head> has theme-color and apple-touch-icon', head.theme.length > 0 && !!head.apple, JSON.stringify(head));
    const man = await L.api(p, 'GET', head.manifest || '/manifest.json');
    let manifest = man.json;
    if (!manifest && man.text) { try { manifest = JSON.parse(man.text); } catch { } }
    S.check('Manifest loads and parses', man.status === 200 && manifest && manifest.name && manifest.start_url && manifest.display, `${man.status} ${man.ct}`);
    const icons = await p.evaluate(async (icons) => Promise.all(icons.map(async i => {
      const r = await fetch(i.src); const b = new Uint8Array(await r.arrayBuffer());
      let w = null, h = null;
      if (b[1] === 0x50 && b[2] === 0x4e) { w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]; h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]; }
      return { src: i.src, sizes: i.sizes, status: r.status, ct: r.headers.get('content-type'), w, h };
    })), manifest?.icons || []);
    for (const i of icons) S.check(`Icon ${i.src} loads with the declared size`, i.status === 200 && /image/.test(i.ct) && (i.sizes === 'any' || i.sizes === `${i.w}x${i.h}`), JSON.stringify(i));
    S.check('Manifest has a maskable icon', (manifest?.icons || []).some(i => /maskable/.test(i.purpose || '')), '');
    const short = (manifest?.shortcuts || []).map(s => s.url);
    S.note('Manifest shortcuts', short.join(', '));
    const sw = await L.api(p, 'GET', '/sw.js');
    S.check('/sw.js is served as JavaScript', sw.status === 200 && /javascript/.test(sw.ct), `${sw.status} ${sw.ct}`);
    const reg = await p.evaluate(async () => { try { const r = await navigator.serviceWorker.register('/sw.js'); return { ok: true, scope: r.scope }; } catch (e) { return { ok: false, err: String(e) }; } });
    S.check('Service worker registers (localhost)', reg.ok, JSON.stringify(reg));
    await L.sleep(3000);
    const after = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    S.note('Service worker on localhost', after === 0 ? 'unregisters itself on activate (dev-host guard in public/sw.js), as designed' : `still registered (${after})`);
    S.note('Automatic registration', 'src/components/PWARegister.tsx only registers when NODE_ENV=production, so `next dev` never registers it');
    await p.ctx.close();

    S.area('Dark mode spot checks');
    const d = await L.person(browser, { viewport: L.PHONE, theme: 'dark' });
    await L.loginApi(d, U);
    for (const path of ['/login', '/events', '/dashboard', '/dashboard/tickets', '/dashboard/settings']) {
      if (path === '/login') { await L.logoutApi(d); }
      await L.go(d, path, { settle: 1500 });
      const c = await d.evaluate(() => { const bg = getComputedStyle(document.body).backgroundColor; const h = document.querySelector('h1') || document.querySelector('main') || document.body; return { bg, fg: getComputedStyle(h).color }; });
      const dark = c.bg.match(/\d+/g).slice(0, 3).every(n => +n < 80), light = c.fg.match(/\d+/g).slice(0, 3).every(n => +n > 150);
      S.check(`${path} dark: dark background, light text`, dark && light, JSON.stringify(c));
      await L.shot(d, `dark${path.replace(/\//g, '_')}-390`);
      if (path === '/login') await L.loginApi(d, U);
    }
    await d.ctx.close();
    await browser.close(); browser = null;

    // ------------------------------------------------------------------ offline tickets (alias host)
    S.area('PWA: tickets page offline');
    const ai = await db.event.findUnique({ where: { slug: 'ai-in-production-talk' }, include: { ticketTypes: true } });
    browser = await L.launch([`--host-resolver-rules=MAP e2e-pwa.test 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${ALIAS}`]);
    const ctx = await browser.createBrowserContext();
    const o = await ctx.newPage();
    await o.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    o.errors = []; o.on('pageerror', e => o.errors.push(String(e.message).slice(0, 200)));
    const r0 = await o.goto(ALIAS + '/api/auth/csrf', { waitUntil: 'networkidle2', timeout: 90000 });
    S.check('Alias host reaches the dev server', r0 && r0.status() === 200, `${r0 && r0.status()}`);
    const who = await o.evaluate(async (email, password) => {
      const { csrfToken } = await (await fetch('/api/auth/csrf')).json();
      await fetch('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, email, password, json: 'true' }), redirect: 'manual' });
      return (await (await fetch('/api/auth/session')).json())?.user?.email;
    }, U, L.PASS);
    S.check('Signs in on the alias host', who === U, String(who));
    const rr = await o.evaluate(async (eventId, ticketTypeId) => (await fetch('/api/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, ticketTypeId, quantity: 1, formResponses: { name: 'E2E-ATT PWA' } }) })).status, ai.id, ai.ticketTypes.find(t => t.name === 'Online').id);
    S.check('Has a ticket to show (free registration)', rr === 201, `status=${rr}`);
    await o.goto(ALIAS + '/dashboard/tickets', { waitUntil: 'networkidle2', timeout: 90000 });
    await L.sleep(2000);
    const hydrated = /AI in Production/.test(await o.evaluate(() => document.body.innerText));
    S.note('Tickets page on the alias host (online)', hydrated ? 'renders the ticket' : 'did not render the ticket (dev server may block /_next/* for non-localhost origins: allowedDevOrigins)');
    const swr = await o.evaluate(async () => { try { await navigator.serviceWorker.register('/sw.js'); const r = await navigator.serviceWorker.ready; return { ok: true, active: !!r.active }; } catch (e) { return { ok: false, err: String(e) }; } });
    S.check('Service worker installs and activates on a non-dev host', swr.ok && swr.active, JSON.stringify(swr));
    await o.reload({ waitUntil: 'networkidle2' });
    await L.sleep(2500);
    const controlled = await o.evaluate(() => !!navigator.serviceWorker.controller);
    // The SW cache holds page shells and assets only; the tickets are kept by the page on the
    // device, for this user only (src/lib/offline-tickets.ts), and removed on sign-out.
    const cached = await o.evaluate(async () => { const out = []; for (const n of await caches.keys()) { if (!n.startsWith('eventflow-')) continue; const c = await caches.open(n); out.push(...(await c.keys()).map(k => new URL(k.url).pathname)); } return out; });
    S.check('Tickets page shell is in the SW cache', cached.includes('/dashboard/tickets') && cached.some(u => u.startsWith('/_next/static/')), cached.filter(u => !u.startsWith('/_next/')).join(', '));
    S.check('No API responses (personal data) in the SW cache', !cached.some(u => u.startsWith('/api/')), cached.filter(u => u.startsWith('/api/')).join(', '));
    const saved = await o.evaluate(() => { try { return JSON.parse(localStorage.getItem('eventflow-offline-tickets:v1')); } catch { return null; } });
    S.check('Tickets are saved on the device for this user only', saved && saved.userId === user.id && saved.tickets.some(t => /AI in Production/.test(t.event.title) && t.qrCode) && !JSON.stringify(saved).includes(U), saved ? `user=${saved.userId === user.id} tickets=${saved.tickets.length} savedAt=${saved.savedAt}` : 'nothing saved');
    S.check('Page is controlled by the service worker', controlled, '');
    // Offline for real: the page (navigator.onLine=false, no sockets) AND the service worker
    // (its fetches fail too; Chrome's page offline mode doesn't reach the SW).
    const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(ALIAS), { timeout: 10000 });
    const swCdp = await swTarget.createCDPSession();
    await swCdp.send('Network.enable');
    const swNet = (offline) => swCdp.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const offlineView = async () => o.evaluate(() => ({
      text: document.body.innerText,
      qr: document.querySelectorAll('svg path[shape-rendering="crispEdges"]').length,
      busy: !!document.querySelector('[aria-busy="true"]'),
      // React debug channel of `next dev`: present only on dev pages
      devDebugChannel: typeof self.__next_r === 'string',
    })).catch(() => ({ text: '', qr: 0, busy: false, devDebugChannel: false }));
    const ticketChecks = (label, v, softReason) => {
      const check = (name, ok, detail = '') => (softReason && !ok ? S.note(label + name, 'not verifiable here: ' + softReason) : S.check(label + name, ok, detail));
      check('the ticket itself is shown (QR usable at the door)', /AI in Production/.test(v.text));
      check('a "You\'re offline" notice is shown', /You.re offline/i.test(v.text) && /saved on this device/i.test(v.text));
      check('notice says when the tickets were last updated', /Last updated/i.test(v.text), v.text.match(/Last updated[^\n]*/)?.[0] || '');
      check('the ticket QR code renders', v.qr > 0, 'qr svgs=' + v.qr);
    };

    // 1) The tickets page is open (loaded online) when the signal drops at the venue
    await o.setOfflineMode(true);
    await swNet(true);
    await L.sleep(3000);
    ticketChecks('Offline (page already open): ', await offlineView());
    await o.screenshot({ path: L.SHOTS + '/pwa-offline-open-tickets-390.png', fullPage: true });

    // 2) Opening the app with no signal: the page comes from the SW cache, the tickets from the device
    let offStatus = 0;
    try { const r = await o.goto(ALIAS + '/dashboard/tickets', { waitUntil: 'networkidle2', timeout: 30000 }); offStatus = r ? r.status() : 0; } catch (e) { offStatus = 'error: ' + e.message.split('\n')[0]; }
    await L.sleep(3000);
    const cold = await offlineView();
    S.check('Offline: /dashboard/tickets still opens from the cache', offStatus === 200 && /Tickets/.test(cold.text), `status=${offStatus} text=${cold.text.slice(0, 120).replace(/\n/g, ' ')}`);
    // Under `next dev` a page served from a cache can't hydrate: its RSC payload needs debug
    // rows that only the dev server streams (over the HMR socket, for that one request). A
    // production build has no debug channel, so there these are real checks.
    ticketChecks('Offline (cold open): ', cold, cold.busy && cold.devDebugChannel ? 'next dev never hydrates a cached page (React debug channel); run against next start' : null);
    await o.screenshot({ path: L.SHOTS + '/pwa-offline-tickets-390.png', fullPage: true });
    let fb = '';
    try { await o.goto(ALIAS + '/dashboard/profile', { waitUntil: 'domcontentloaded', timeout: 30000 }); fb = await o.evaluate(() => document.body.innerText); } catch (e) { fb = 'error: ' + e.message; }
    S.check('Offline: an uncached page falls back to /offline', /offline/i.test(fb), fb.slice(0, 120).replace(/\n/g, ' '));
    await swNet(false);
    await o.setOfflineMode(false);
    // Signing out (here: the API, as another tab or an expired session would) removes the
    // device copy and the cached signed-in pages on the next page load, so the next person
    // on this device never sees these tickets.
    await o.goto(ALIAS + '/events', { waitUntil: 'networkidle2', timeout: 90000 });
    for (let i = 0; i < 3; i++) {
      try { await o.evaluate(async () => { const { csrfToken } = await (await fetch('/api/auth/csrf')).json(); await fetch('/api/auth/signout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, json: 'true' }), redirect: 'manual' }); }); break; }
      catch (e) { if (i === 2) throw e; await L.sleep(2000); }
    }
    await o.goto(ALIAS + '/', { waitUntil: 'networkidle2', timeout: 90000 });
    await L.sleep(3000);
    const gone = await o.evaluate(async () => { const out = []; for (const n of await caches.keys()) { const c = await caches.open(n); out.push(...(await c.keys()).map(k => new URL(k.url).pathname)); } return { saved: localStorage.getItem('eventflow-offline-tickets:v1'), pages: out.filter(p => p.startsWith('/dashboard')) }; });
    S.check('After sign-out the saved tickets and cached ticket page are removed', gone.saved === null && gone.pages.length === 0, JSON.stringify({ saved: !!gone.saved, pages: gone.pages }));
    await o.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
    await ctx.close();
  } catch (e) {
    S.check('script crashed', false, e.stack);
  } finally {
    if (browser) await browser.close();
    await L.purgeUsers([U]);
    await db.$disconnect();
  }
  process.exitCode = S.finish() ? 1 : 0;
})();
