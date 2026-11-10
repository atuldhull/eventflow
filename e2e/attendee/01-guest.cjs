// Guest (signed-out visitor) journeys: landing, browse/search/filter, event page, guest
// registration for a free ticket, paid tickets need sign-in, certificate verification,
// public org / enterprise profiles, 404s and /offline.
// Run: node e2e/attendee/01-guest.cjs
const L = require('./lib.cjs');
const { db, BASE } = L;
const S = L.suite('01-guest');

const GUEST_EMAIL = 'e2e-att-guest@test.local';
const GUEST_PAID_EMAIL = 'e2e-att-guestpaid@test.local';
const TERMS_SLUG = 'e2e-att-terms-event';

async function uiStartRegister(page, slug, ticketRe) {
  await L.go(page, `/events/${slug}/register`, { settle: 1200 });
  await L.waitText(page, /Choose your ticket/);
  if (ticketRe) await L.clickText(page, ticketRe, 'label');
  await L.sleep(200);
  await L.clickText(page, /^Continue$/, 'button');
  return L.waitText(page, /Full name/);
}

(async () => {
  if (!(await L.serverUp())) { console.error('Server not responding at ' + BASE); process.exit(2); }
  await L.snapshotCounters();
  const browser = await L.launch();
  try {
    // ------------------------------------------------------------------ landing + static pages
    S.area('Guest: landing and public pages');
    for (const vp of process.env.QUICK ? [] : [L.DESKTOP, L.PHONE]) { // QUICK=1 skips this sweep
      const page = await L.person(browser, { viewport: vp });
      const tag = vp.width;
      for (const p of ['/', '/events', '/about', '/pricing', '/for-organizers', '/contact', '/privacy', '/terms', '/verify', '/offline', '/org/tech-club', '/enterprise/demo-university']) {
        page.errors.length = 0;
        const st = await L.go(page, p, { settle: 400 });
        const ov = await L.overflowX(page);
        S.check(`${p} @${tag}: 200, no horizontal overflow, no console errors`, st === 200 && ov <= 0 && page.errors.length === 0, `status=${st} overflow=${ov} errors=${page.errors.slice(0, 2).join(' | ')}`);
        if (p === '/' || p === '/events' || p === '/offline') await L.shot(page, `guest-${p.replace(/\//g, '_') || 'home'}-${tag}`);
      }
      await page.ctx.close();
    }

    const page = await L.person(browser, { viewport: L.DESKTOP });
    await L.go(page, '/');
    const home = await L.bodyText(page);
    const homeLinks = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
    S.check('Landing has a way to browse events', homeLinks.some(h => h === '/events' || h.startsWith('/events?')), homeLinks.filter(h => h.startsWith('/events')).slice(0, 5).join(','));
    S.check('Landing links categories to /events?category=', homeLinks.some(h => /\/events\?category=/.test(h)), '');
    S.check('Landing shows real upcoming events (no DRAFT)', !/Open Source Contribution Sprint/i.test(home), '');

    // ------------------------------------------------------------------ /events browse
    S.area('Guest: /events search, categories, pricing, pagination');
    const all = await L.api(page, 'GET', '/api/events?limit=50');
    const list = all.json?.data?.events || all.json?.data || [];
    S.check('GET /api/events returns events', all.status === 200 && Array.isArray(list) && list.length > 0, `status=${all.status} n=${list.length}`);
    const slugs = list.map(e => e.slug);
    S.check('Draft event is not listed', !slugs.includes('open-source-sprint-2027'), slugs.join(','));
    S.note('Listed slugs', slugs.join(', '));

    await L.go(page, '/events', { settle: 1500 });
    await L.typeInto(page, 'input[aria-label="Search events"]', 'rust');
    await L.sleep(1500);
    let txt = await L.bodyText(page);
    S.check('Search "rust" shows Rust for Systems', /Rust for Systems/i.test(txt), '');
    S.check('Search "rust" hides unrelated events', !/Carnatic Evening/i.test(txt), '');
    S.check('Search is reflected in the URL (?search=rust)', /search=rust/.test(page.url()), page.url());
    await L.typeInto(page, 'input[aria-label="Search events"]', 'zzqqxx-nothing');
    await L.sleep(1500);
    txt = await L.bodyText(page);
    S.check('Search with no results shows an empty state', /no events|nothing|no results|couldn.t find/i.test(txt), txt.slice(0, 200).replace(/\n/g, ' '));
    await L.shot(page, 'guest-events-empty-search');

    await L.go(page, '/events', { settle: 1500 });
    const chipClicked = await L.clickText(page, /^Workshop$/, '[aria-label=Category] button');
    await L.sleep(1500);
    txt = await L.bodyText(page);
    const pressed = await page.evaluate(() => [...document.querySelectorAll('[aria-label=Category] button[aria-pressed=true]')].map(b => b.innerText.trim()));
    S.check('Category chip "Workshop" selects and filters', chipClicked && pressed.includes('Workshop') && /Rust for Systems/.test(txt) && !/Carnatic Evening/.test(txt), `pressed=${pressed} url=${page.url()}`);
    S.check('Category chip is reflected in the URL', /category=/i.test(page.url()), page.url());

    await L.go(page, '/events?category=concert', { settle: 1500 });
    const pressed2 = await page.evaluate(() => [...document.querySelectorAll('[aria-label=Category] button[aria-pressed=true]')].map(b => b.innerText.trim()));
    txt = await L.bodyText(page);
    S.check('?category=concert (lowercase) preselects the Concert chip and filters', pressed2.includes('Concert') && /Carnatic Evening/.test(txt) && !/Rust for Systems/.test(txt), `pressed=${pressed2}`);

    await L.go(page, '/events', { settle: 1500 });
    await L.clickText(page, /^Free$/, '[aria-label=Price] button');
    await L.sleep(1500);
    txt = await L.bodyText(page);
    S.check('Free toggle: shows free events, hides paid', /AI in Production|Carnatic/i.test(txt) && !/Rust for Systems|Utsav/i.test(txt), page.url());
    await L.clickText(page, /^Paid$/, '[aria-label=Price] button');
    await L.sleep(1500);
    txt = await L.bodyText(page);
    S.check('Paid toggle: shows paid events, hides free', /Rust for Systems|Utsav/i.test(txt) && !/Carnatic Evening/i.test(txt), page.url());

    const p1 = await L.api(page, 'GET', '/api/events?limit=2&page=1');
    const p2 = await L.api(page, 'GET', '/api/events?limit=2&page=2');
    const ids1 = (p1.json?.data?.events || p1.json?.data || []).map(e => e.id), ids2 = (p2.json?.data?.events || p2.json?.data || []).map(e => e.id);
    const pag = p1.json?.pagination || p1.json?.data?.pagination || p1.json?.meta;
    S.check('Pagination API: page 2 differs from page 1 and totals are reported', ids1.length === 2 && ids2.length > 0 && !ids2.some(i => ids1.includes(i)) && !!pag, JSON.stringify(pag));
    S.note('Pagination UI', `with ${list.length} public events and limit 12 the Previous/Next bar never appears in the UI (only the API was exercised)`);

    // ------------------------------------------------------------------ event page
    S.area('Guest: event page');
    for (const vp of [L.DESKTOP, L.PHONE]) {
      const pg = await L.person(browser, { viewport: vp });
      const st = await L.go(pg, '/events/ai-in-production-talk', { settle: 1500 });
      const t = await L.bodyText(pg);
      S.check(`Event page @${vp.width}: 200 and key sections present (title, date, venue, about, tickets, organizer)`,
        st === 200 && /AI in Production/i.test(t) && /Tech Club/.test(t) && /(about|description)/i.test(t) && /(In person|Online)/.test(t) && /Register/i.test(t),
        `status=${st}`);
      S.check(`Event page @${vp.width}: no console errors / overflow`, pg.errors.length === 0 && (await L.overflowX(pg)) <= 0, pg.errors.slice(0, 2).join(' | '));
      await L.shot(pg, `guest-event-page-${vp.width}`);
      if (vp.isMobile) {
        // The bar shows whenever the register card's button is off screen and the footer isn't in view
        const state = () => pg.evaluate(() => {
          const b = document.querySelector('[data-bottombar]'), c = document.getElementById('event-register-cta'), f = document.querySelector('footer');
          const cr = c?.getBoundingClientRect(), fr = f?.getBoundingClientRect();
          return { bar: b?.getAttribute('aria-hidden'), ctaVisible: !!cr && cr.bottom > 0 && cr.top < innerHeight, footerVisible: !!fr && fr.top < innerHeight, text: b?.innerText.replace(/\s+/g, ' ') };
        });
        const ctaTop = await pg.evaluate(() => document.getElementById('event-register-cta')?.getBoundingClientRect().top + scrollY);
        const footTop = await pg.evaluate(() => document.querySelector('footer')?.getBoundingClientRect().top + scrollY);
        await pg.evaluate(y => window.scrollTo(0, y), Math.max(0, ctaTop - 300)); await L.sleep(700);
        const sCta = await state();
        const gapY = ctaTop + 80; // just past the CTA
        await pg.evaluate(y => window.scrollTo(0, y), gapY); await L.sleep(700);
        const sGap = await state();
        await pg.screenshot({ path: L.SHOTS + '/guest-event-sticky-bar-390.png' });
        await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await L.sleep(700);
        const sFoot = await state();
        S.check('Phone: sticky bar hides while the register button is on screen', sCta.ctaVisible && sCta.bar === 'true', JSON.stringify(sCta));
        if (!sGap.footerVisible) S.check('Phone: sticky bar (with Register) shows once the register button scrolls away', sGap.bar === 'false' && /Register/.test(sGap.text || ''), JSON.stringify(sGap));
        else S.note('Phone: sticky bar', `page too short to test (footer already visible just past the CTA; cta at ${ctaTop}px, footer at ${footTop}px)`);
        S.check('Phone: sticky bar steps aside at the footer', sFoot.bar === 'true', JSON.stringify(sFoot));
        S.note('Phone: sticky bar window', `register button at y=${Math.round(ctaTop)}, footer at y=${Math.round(footTop)}: the bar is only useful for ~${Math.round(footTop - ctaTop - 844)}px of scrolling`);
        // dark spot check
        await pg.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
        await L.go(pg, '/events/ai-in-production-talk', { settle: 1500 });
        const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
        S.check('Dark mode: event page body background is dark', /rgb\((\d+), (\d+), (\d+)\)/.test(bg) && bg.match(/\d+/g).slice(0, 3).every(n => +n < 80), bg);
        await L.shot(pg, 'guest-event-page-390-dark');
      }
      await pg.ctx.close();
    }
    await L.go(page, '/events/hack-the-monsoon-2026', { settle: 1500 });
    txt = await L.bodyText(page);
    const regLink = await page.evaluate(() => !![...document.querySelectorAll('a[href$="/register"]')].find(a => a.getBoundingClientRect().width > 0));
    S.check('Completed event: shows an ended state and no Register link', /(ended|completed|past event|closed)/i.test(txt) && !regLink, `regLink=${regLink}`);
    await L.shot(page, 'guest-event-completed');

    // ------------------------------------------------------------------ 404s
    S.area('Guest: 404s');
    for (const p of ['/this-page-does-not-exist', '/events/does-not-exist-e2e', '/events/open-source-sprint-2027', '/org/no-such-org-e2e', '/enterprise/no-such-ent-e2e', '/verify/NOSUCHCODE99']) {
      const st = await L.go(page, p, { settle: 300 });
      const t = await L.bodyText(page);
      if (p.startsWith('/verify/')) S.check(`${p}: says not found`, /not found|no certificate|couldn.t find|invalid/i.test(t), `status=${st}`);
      else S.check(`${p}: HTTP 404`, st === 404, `status=${st} landed=${page.url().replace(BASE, '')} text=${t.slice(0, 80).replace(/\n/g, ' ')}`);
    }
    const reg404 = await L.go(page, '/events/does-not-exist-e2e/register', { settle: 1000 });
    S.check('/events/<unknown>/register: 404 (not a blank form)', reg404 === 404, `status=${reg404}`);

    // ------------------------------------------------------------------ certificate verify
    S.area('Guest: /verify/[code]');
    const carolCert = await db.certificate.findFirst({ where: { user: { email: 'carol@test.local' } } });
    const guestUser = await L.ensureUser('e2e-att-certholder@test.local', 'E2E Cert Holder');
    const hack = await db.event.findUnique({ where: { slug: 'hack-the-monsoon-2026' } });
    await db.certificate.deleteMany({ where: { userId: guestUser.id } });
    const pend = await db.certificate.create({ data: { certificateNumber: 'E2E-ATT-PEND-1', eventId: hack.id, userId: guestUser.id, type: 'PARTICIPATION', title: 'E2E pending', recipientName: 'E2E Cert Holder', issuedDate: new Date(), verificationCode: 'E2EATTPEND01', status: 'PENDING' } });
    const rev = await db.certificate.create({ data: { certificateNumber: 'E2E-ATT-REV-1', eventId: hack.id, userId: guestUser.id, type: 'WINNER', title: 'E2E revoked', recipientName: 'E2E Cert Holder', issuedDate: new Date(), verificationCode: 'E2EATTREV001', status: 'GENERATED', metadata: { revokedAt: new Date().toISOString(), revokedBy: 'e2e' } } });
    L.track('certificates', pend.id); L.track('certificates', rev.id);
    await L.go(page, `/verify/${carolCert.verificationCode}`);
    txt = await L.bodyText(page);
    S.check('Valid certificate: shows Valid with recipient and event', /Valid/.test(txt) && /Hack the Monsoon/i.test(txt), txt.slice(0, 160).replace(/\n/g, ' '));
    await L.shot(page, 'guest-verify-valid');
    await L.go(page, '/verify/E2EATTPEND01');
    txt = await L.bodyText(page);
    S.check('Pending certificate: "Not issued yet"', /Not issued yet/i.test(txt) && !/\bValid\b/.test(txt.replace(/verif/gi, '')), '');
    await L.go(page, '/verify/E2EATTREV001');
    txt = await L.bodyText(page);
    S.check('Revoked certificate: "Certificate revoked"', /revoked/i.test(txt), '');
    await L.shot(page, 'guest-verify-revoked');
    const vapi = await L.api(page, 'GET', '/api/certificates/verify?code=E2EATTREV001');
    S.check('Verify API reports revoked (not valid)', vapi.json && vapi.json.success !== undefined && !(vapi.json.data?.valid), JSON.stringify(vapi.json).slice(0, 200));
    await L.go(page, '/verify');
    await L.typeInto(page, '#verify-code', ` ${carolCert.verificationCode} `);
    await page.keyboard.press('Enter');
    await L.sleep(2500);
    S.check('/verify form: typing a code (with spaces) opens its result page', page.url().endsWith('/verify/' + carolCert.verificationCode), page.url());

    // ------------------------------------------------------------------ org / enterprise
    S.area('Guest: public org and enterprise pages');
    await L.go(page, '/org/tech-club');
    txt = await L.bodyText(page);
    S.check('/org/tech-club shows the org and its upcoming events', /Tech Club/.test(txt) && /(Rust for Systems|AI in Production)/i.test(txt) && !/Open Source Contribution Sprint/i.test(txt), '');
    await L.go(page, '/enterprise/demo-university');
    txt = await L.bodyText(page);
    S.check('/enterprise/demo-university shows the enterprise and its organizations', /Demo University/.test(txt) && /(Tech Club|Cultural Society)/.test(txt), '');

    // ------------------------------------------------------------------ guest registration (free)
    S.area('Guest: free registration');
    await L.purgeUsers([GUEST_EMAIL]);
    const carnatic = await db.event.findUnique({ where: { slug: 'carnatic-evening' }, include: { ticketTypes: true } });
    const before = { cur: carnatic.currentRegistrations, sold: carnatic.ticketTypes[0].sold };
    const gp = await L.person(browser, { viewport: L.PHONE });
    const atDetails = await uiStartRegister(gp, 'carnatic-evening');
    S.check('Phone: ticket step -> Continue -> details step', atDetails, '');
    const guestBanner = /Registering as a guest/i.test(await L.bodyText(gp));
    S.check('Details step tells a guest they are registering as a guest (with Sign in link)', guestBanner, '');
    await L.clickText(gp, /^Continue$/, 'button');
    await L.sleep(700);
    let errs = await gp.evaluate(() => [...document.querySelectorAll('[aria-invalid=true]')].map(e => e.id));
    S.check('Empty details: Continue is refused and name + email are flagged', errs.includes('reg-name') && errs.includes('reg-email'), errs.join(','));
    const focused = await gp.evaluate(() => document.activeElement && document.activeElement.id);
    S.check('Empty details: focus moves to the first invalid field', focused === 'reg-name', `focused=${focused}`);
    await L.shot(gp, 'guest-register-errors-390');
    await L.typeInto(gp, '#reg-name', 'E2E Guest');
    await L.typeInto(gp, '#reg-email', 'not-an-email');
    await L.clickText(gp, /^Continue$/, 'button');
    await L.sleep(500);
    errs = await gp.evaluate(() => [...document.querySelectorAll('[aria-invalid=true]')].map(e => e.id));
    S.check('Invalid email is flagged', errs.includes('reg-email') && !errs.includes('reg-name'), errs.join(','));
    await L.typeInto(gp, '#reg-email', GUEST_EMAIL);
    await L.clickText(gp, /^Continue$/, 'button');
    const atReview = await L.waitText(gp, /Confirm registration/);
    S.check('Valid details -> Review step with "Confirm registration"', atReview, '');
    const reviewTxt = await L.bodyText(gp);
    S.check('Review shows the entered name and email', reviewTxt.includes('E2E Guest') && reviewTxt.includes(GUEST_EMAIL), '');
    await L.shot(gp, 'guest-register-review-390');
    await L.clickText(gp, /Confirm registration/, 'button');
    const ok = await L.waitText(gp, /You're registered!/, 30000);
    S.check('Guest free registration succeeds ("You\'re registered!")', ok, (await L.toasts(gp)).join(' | '));
    await L.shot(gp, 'guest-register-success-390');
    const succ = await L.bodyText(gp);
    const hasQrOnSuccess = await gp.evaluate(() => !!document.querySelector('svg[class*=qr], canvas, img[alt*=QR i], svg path[d][fill]'));
    S.note('Guest success screen', `QR shown: ${hasQrOnSuccess}; text mentions My Tickets: ${/My Tickets/.test(succ)}`);
    const gu = await db.user.findUnique({ where: { email: GUEST_EMAIL }, include: { registrations: { include: { ticket: true } } } });
    if (gu) L.track('users', GUEST_EMAIL);
    const greg = gu?.registrations.find(r => r.eventId === carnatic.id);
    S.check('DB: guest account created without a password', gu && !gu.passwordHash, '');
    S.check('DB: registration CONFIRMED with an ACTIVE ticket', greg && greg.status === 'CONFIRMED' && greg.ticket?.status === 'ACTIVE', greg ? `${greg.status}/${greg.ticket?.status}` : 'none');
    const after = await db.event.findUnique({ where: { id: carnatic.id }, include: { ticketTypes: true } });
    S.check('Counters: event seats +1 and ticket stock +1', after.currentRegistrations === before.cur + 1 && after.ticketTypes[0].sold === before.sold + 1, `cur ${before.cur}->${after.currentRegistrations} sold ${before.sold}->${after.ticketTypes[0].sold}`);
    const pubEv = await L.api(gp, 'GET', '/api/events/carnatic-evening');
    const pubCur = pubEv.json?.data?.currentRegistrations ?? pubEv.json?.data?.event?.currentRegistrations;
    S.check('Public event API shows the new count', pubCur === before.cur + 1, `api=${pubCur}`);
    if (greg?.ticket) {
      // A guest has no account: the success screen offers a private ticket link (token in the URL)
      const link = await gp.evaluate(() => [...document.querySelectorAll('a')].find(a => /Open my ticket/i.test(a.innerText))?.getAttribute('href'));
      S.check('Success screen offers "Open my ticket" (private guest link)', !!link && link.startsWith('/events/'), String(link));
      if (link) {
        const anon = await L.person(browser, { viewport: L.PHONE });
        const st = await L.go(anon, link, { settle: 1500 });
        const txt = await L.bodyText(anon);
        S.check('The guest link opens the ticket without signing in (QR + ticket number)', st === 200 && txt.includes(greg.ticket.ticketNumber), `status=${st}`);
        const pdfHref = await anon.evaluate(() => [...document.querySelectorAll('a')].find(a => /pdf|download/i.test(a.innerText + a.getAttribute('href')))?.getAttribute('href'));
        if (pdfHref) { const pdf = await L.api(anon, 'GET', pdfHref); S.check('Guest can download the ticket PDF from that page', pdf.status === 200 && pdf.head.startsWith('%PDF'), `${pdf.status} ${pdf.ct}`); }
        else S.note('Guest ticket page has no PDF link', '');
        const bad = await L.go(anon, link.replace(/([?&]k=)[^&]+/, '$1wrong'), { settle: 800 });
        S.check('A tampered guest link does not show the ticket', !(await L.bodyText(anon)).includes(greg.ticket.ticketNumber), `status=${bad}`);
        await anon.ctx.close();
      }
    }
    // registering again with the same email
    await uiStartRegister(gp, 'carnatic-evening');
    await L.shot(gp, 'guest-register-again-390');
    await L.typeInto(gp, '#reg-name', 'E2E Guest');
    await L.typeInto(gp, '#reg-email', GUEST_EMAIL);
    await L.clickText(gp, /^Continue$/, 'button');
    await L.waitText(gp, /Confirm registration/);
    await L.clickText(gp, /Confirm registration/, 'button');
    await L.sleep(2500);
    const t2 = await L.toasts(gp);
    S.check('Same email again: refused with "already registered"', t2.some(t => /already registered/i.test(t)), t2.join(' | '));
    const after2 = await db.event.findUnique({ where: { id: carnatic.id } });
    S.check('Duplicate attempt does not move the counter', after2.currentRegistrations === before.cur + 1, `${after2.currentRegistrations}`);
    // API-level validation
    const v1 = await L.api(gp, 'POST', '/api/registrations', { eventId: carnatic.id, ticketTypeId: carnatic.ticketTypes[0].id, quantity: 1, guestName: 'E', guestEmail: 'e2e-att-x@test.local' });
    const v2 = await L.api(gp, 'POST', '/api/registrations', { eventId: carnatic.id, ticketTypeId: carnatic.ticketTypes[0].id, quantity: 1, guestName: 'E2E Ok', guestEmail: 'bad@' });
    S.check('API: 1-letter guest name and bad email -> 400', v1.status === 400 && v2.status === 400, `${v1.status}/${v2.status}`);
    const stray = await db.user.findUnique({ where: { email: 'e2e-att-x@test.local' } });
    S.check('API: refused guest request creates no account', !stray, '');
    await gp.ctx.close();

    // ------------------------------------------------------------------ terms (temporary unlisted event)
    S.area('Guest: terms and conditions');
    const alice = await db.user.findUnique({ where: { email: 'alice@test.local' } });
    const techClub = await db.organization.findUnique({ where: { slug: 'tech-club' } });
    await db.event.deleteMany({ where: { slug: TERMS_SLUG } });
    const tev = await db.event.create({ data: { title: 'E2E-ATT Terms Event', slug: TERMS_SLUG, description: 'Temporary e2e event (deleted by the test).', status: 'REGISTRATION_OPEN', visibility: 'UNLISTED', category: 'Talk', startDate: new Date(Date.now() + 30 * 864e5), endDate: new Date(Date.now() + 30 * 864e5 + 2 * 36e5), venue: 'E2E Hall', maxCapacity: 10, termsAndConditions: 'E2E terms: be kind.', organizationId: techClub.id, createdById: alice.id, publishedAt: new Date(), ticketTypes: { create: [{ name: 'E2E Free', price: 0, quantity: 10 }] } } });
    L.track('events', tev.id);
    try {
      const tp = await L.person(browser, { viewport: L.PHONE });
      await uiStartRegister(tp, TERMS_SLUG);
      await L.typeInto(tp, '#reg-name', 'E2E Terms');
      await L.typeInto(tp, '#reg-email', 'e2e-att-terms@test.local');
      await L.clickText(tp, /^Continue$/, 'button');
      await L.sleep(600);
      const termsErr = await tp.evaluate(() => {
        const box = document.querySelector('[role=checkbox]');
        return { stillDetails: !/Confirm registration/.test(document.body.innerText), msg: document.getElementById('terms-error')?.innerText, boxInvalid: box?.getAttribute('aria-invalid'), boxDescribedBy: box?.getAttribute('aria-describedby'), focused: document.activeElement?.getAttribute('role') || document.activeElement?.tagName };
      });
      S.check('Terms not ticked: Continue refused with a terms error message', termsErr.stillDetails && !!termsErr.msg, JSON.stringify(termsErr));
      S.check('Terms error is announced: checkbox gets aria-invalid + aria-describedby', termsErr.boxInvalid === 'true' && termsErr.boxDescribedBy === 'terms-error', JSON.stringify(termsErr));
      await L.shot(tp, 'guest-terms-error-390');
      await tp.click('label[for=terms]');
      await L.clickText(tp, /^Continue$/, 'button');
      S.check('Terms ticked: reaches Review', await L.waitText(tp, /Confirm registration/), '');
      await tp.ctx.close();
      const leftover = await db.user.findUnique({ where: { email: 'e2e-att-terms@test.local' } });
      if (leftover) L.track('users', leftover.email);
    } finally {
      await db.event.delete({ where: { id: tev.id } }).catch(() => { });
    }

    // ------------------------------------------------------------------ paid ticket requires sign-in
    S.area('Guest: paid tickets need sign-in');
    const rust = await db.event.findUnique({ where: { slug: 'rust-systems-workshop' }, include: { ticketTypes: true } });
    const std = rust.ticketTypes.find(t => t.name === 'Standard');
    const pp = await L.person(browser, { viewport: L.PHONE });
    // Guests are told at the ticket step (before typing their details) that paid tickets need an account
    await uiStartRegister(pp, 'rust-systems-workshop', /Standard/);
    await L.sleep(800);
    const tv = await L.bodyText(pp);
    S.check('Ticket step (guest, paid): each paid ticket says "Sign in to buy"', /Sign in to buy/i.test(tv), '');
    S.check('Ticket step (guest, paid): explains that paid tickets need an account', /Paid tickets need an account/i.test(tv), '');
    await L.shot(pp, 'guest-paid-ticket-step-390');
    await L.clickText(pp, /^Continue$/, 'button');
    await L.sleep(1200);
    const stillTicketStep = !(await pp.$('#reg-name')) && /Choose your ticket/i.test(await L.bodyText(pp));
    S.check('Continue doesn\'t take a guest past a paid ticket (no details form)', stillTicketStep, '');
    const signIn = await pp.evaluate(() => [...document.querySelectorAll('a')].some(a => /\/login/.test(a.getAttribute('href') || '') && /sign in/i.test(a.innerText)));
    S.check('A "Sign in" link is offered', signIn, '');
    const apiPaid = await L.api(pp, 'POST', '/api/registrations', { eventId: rust.id, ticketTypeId: std.id, quantity: 1, guestName: 'E2E Paid Guest', guestEmail: GUEST_PAID_EMAIL });
    S.check('API: guest + paid ticket -> 401 "Please log in to buy a paid ticket."', apiPaid.status === 401 && /log in to buy a paid/i.test(apiPaid.json?.message || ''), `${apiPaid.status} ${apiPaid.json?.message}`);
    S.check('API: no account or seat is created for the refused paid guest', !(await db.user.findUnique({ where: { email: GUEST_PAID_EMAIL } })) && (await db.ticketType.findUnique({ where: { id: std.id } })).sold === std.sold, '');
    await pp.ctx.close();

    await page.ctx.close();
  } catch (e) {
    S.check('script crashed', false, e.stack);
  } finally {
    await browser.close();
    await db.$disconnect();
  }
  process.exitCode = S.finish() ? 1 : 0;
})();
