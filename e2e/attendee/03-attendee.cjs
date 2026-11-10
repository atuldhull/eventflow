// Signed-in student journeys with own e2e accounts, and how each action reflects for the
// organizer (alice): free registration -> ticket, dashboard counts, notification, event
// page state, organizer list and counters; ticket dialog (full-screen QR, PDF, .ics);
// door scan of the issued QR; transfer; cancel (seat + stock back); paid ticket seat hold
// with payments not configured; saved events; notifications; profile; settings.
// Run: node e2e/attendee/03-attendee.cjs
const L = require('./lib.cjs');
const { db, BASE, PASS } = L;
const S = L.suite('03-attendee');
// SKIP=scan,dialog,transfer,cancel,paid,saved,notifications,profile,settings skips sections
// ('register' feeds scan/dialog/transfer, so keep it when running those)
const SKIP = (process.env.SKIP || '').split(',').filter(Boolean);

const U1 = 'e2e-att-1@test.local';
const U2 = 'e2e-att-2@test.local';

const num = (json, key) => { const m = JSON.stringify(json || {}).match(new RegExp(`"${key}":(\\d+)`)); return m ? +m[1] : null; };

async function counters(slug) {
  const e = await db.event.findUnique({ where: { slug }, include: { ticketTypes: { orderBy: { sortOrder: 'asc' } } } });
  return { id: e.id, cur: e.currentRegistrations, sold: Object.fromEntries(e.ticketTypes.map(t => [t.name, t.sold])), tt: Object.fromEntries(e.ticketTypes.map(t => [t.name, t.id])) };
}

async function uiRegister(page, slug, ticketRe) {
  await L.go(page, `/events/${slug}/register`, { settle: 1500 });
  await L.waitText(page, /Choose your ticket/);
  if (ticketRe) await L.clickText(page, ticketRe, 'label');
  await L.clickText(page, /^Continue$/, 'button');
  await L.waitText(page, /Full name/);
  const prefill = await page.evaluate(() => ({ name: document.getElementById('reg-name')?.value, email: document.getElementById('reg-email')?.value, emailDisabled: document.getElementById('reg-email')?.disabled }));
  await L.clickText(page, /^Continue$/, 'button');
  await L.waitText(page, /(Confirm registration|Pay ₹)/);
  await L.clickText(page, /(Confirm registration|Pay ₹)/, 'button');
  return prefill;
}

(async () => {
  if (!(await L.serverUp())) { console.error('Server not responding at ' + BASE); process.exit(2); }
  await L.snapshotCounters();
  await L.purgeUsers([U1, U2]);
  const u1 = await L.ensureUser(U1, 'E2E-ATT One');
  const u2 = await L.ensureUser(U2, 'E2E-ATT Two');
  const techClub = await db.organization.findUnique({ where: { slug: 'tech-club' } });
  const cultural = await db.organization.findUnique({ where: { slug: 'cultural-society' } });
  const browser = await L.launch();
  let a1, alice, bob, ai0, ai1, reg, ph, other, t;
  try {
    alice = await L.person(browser);
    S.area('Setup');
    S.check('alice (Tech Club admin) signs in', (await L.loginApi(alice, 'alice@test.local', L.DEMO_PASS)) === 'alice@test.local', '');
    bob = await L.person(browser);
    S.check('bob (Cultural Society admin) signs in', (await L.loginApi(bob, 'bob@test.local', L.DEMO_PASS)) === 'bob@test.local', '');

    // ------------------------------------------------------------------ free registration + reflections
    if (!SKIP.includes('register')) try {
      S.area('Attendee: free registration reflects everywhere');
      a1 = await L.person(browser, { viewport: L.DESKTOP });
      S.check('e2e-att-1 signs in', (await L.loginApi(a1, U1)) === U1, '');
      ai0 = await counters('ai-in-production-talk');
      const dash0 = (await L.api(a1, 'GET', '/api/users/me/dashboard')).json?.data?.stats || {};
      const notif0 = num((await L.api(a1, 'GET', '/api/notifications/unread-count')).json, 'count') ?? 0;
      const orgStats0 = (await L.api(alice, 'GET', `/api/admin/org/${techClub.id}/dashboard-stats`)).json;
      const evAdmin0 = (await L.api(alice, 'GET', `/api/admin/org/${techClub.id}/events/${ai0.id}`)).json;
      const prefill = await uiRegister(a1, 'ai-in-production-talk', /In person/);
      S.check('Details are pre-filled from the account (name, email locked)', prefill.name === 'E2E-ATT One' && prefill.email === U1 && prefill.emailDisabled, JSON.stringify(prefill));
      S.check('Free registration succeeds ("You\'re registered!")', await L.waitText(a1, /You're registered!/, 30000), (await L.toasts(a1)).join(' | '));
      await L.shot(a1, 'att-register-success-1440');
      reg = await db.registration.findUnique({ where: { eventId_userId: { eventId: ai0.id, userId: u1.id } }, include: { ticket: true } });
      S.check('DB: CONFIRMED registration with an ACTIVE ticket of the chosen type', reg?.status === 'CONFIRMED' && reg.ticket?.status === 'ACTIVE' && reg.ticketTypeId === ai0.tt['In person'], reg ? `${reg.status}/${reg.ticket?.status}` : 'none');
      ai1 = await counters('ai-in-production-talk');
      S.check('Event seats +1 and "In person" stock +1 (Online untouched)', ai1.cur === ai0.cur + 1 && ai1.sold['In person'] === ai0.sold['In person'] + 1 && ai1.sold['Online'] === ai0.sold['Online'], `cur ${ai0.cur}->${ai1.cur} sold ${JSON.stringify(ai0.sold)}->${JSON.stringify(ai1.sold)}`);
  
      await L.go(a1, '/dashboard/tickets', { settle: 2500 });
      t = await L.bodyText(a1);
      S.check('/dashboard/tickets lists the new ticket with event, type and ticket number', /AI in Production/.test(t) && /In person/i.test(t) && t.includes(reg.ticket.ticketNumber), t.slice(0, 300).replace(/\n/g, ' '));
      S.check('/dashboard/tickets shows date and venue', /Dec/i.test(t), '');
      await L.shot(a1, 'att-tickets-1440');
      const dash1 = (await L.api(a1, 'GET', '/api/users/me/dashboard')).json?.data || {};
      S.check('Dashboard counts: registrations +1, active tickets +1', dash1.stats?.registrations === (dash0.registrations || 0) + 1 && dash1.stats?.activeTickets === (dash0.activeTickets || 0) + 1, `${JSON.stringify(dash0)} -> ${JSON.stringify(dash1.stats)}`);
      S.check('Dashboard "upcoming" includes the event', (dash1.upcomingEvents || []).some(e => e.slug === 'ai-in-production-talk'), '');
      await L.go(a1, '/dashboard', { settle: 2000 });
      S.check('/dashboard page shows the event as next up', /AI in Production/.test(await L.bodyText(a1)), '');
      const notif1 = num((await L.api(a1, 'GET', '/api/notifications/unread-count')).json, 'count') ?? 0;
      const nl = (await L.api(a1, 'GET', '/api/notifications')).json;
      S.check('An in-app notification confirms the registration', notif1 === notif0 + 1 && /Registration Confirmed|registered/i.test(JSON.stringify(nl)), `unread ${notif0}->${notif1}`);
      await L.go(a1, '/events/ai-in-production-talk', { settle: 1500 });
      t = await L.bodyText(a1);
      S.check('Event page now says the user is registered (View my ticket)', /registered/i.test(t) && /View (my )?ticket/i.test(t), '');
      const regs = await L.api(alice, 'GET', `/api/admin/org/${techClub.id}/registrations?eventId=${ai0.id}&search=e2e-att-1`);
      const regRow = JSON.stringify(regs.json || {});
      S.check('alice: organizer registrations list shows the student as CONFIRMED', regRow.includes(U1) && /CONFIRMED/.test(regRow), `status=${regs.status}`);
      const evAdmin1 = (await L.api(alice, 'GET', `/api/admin/org/${techClub.id}/events/${ai0.id}`)).json;
      S.check('alice: event detail counter +1', num(evAdmin1, 'currentRegistrations') === num(evAdmin0, 'currentRegistrations') + 1, `${num(evAdmin0, 'currentRegistrations')} -> ${num(evAdmin1, 'currentRegistrations')}`);
      const orgStats1 = (await L.api(alice, 'GET', `/api/admin/org/${techClub.id}/dashboard-stats`)).json;
      const keys = ['registrationCount', 'totalRegistrations'];
      const k = keys.find(k => num(orgStats0, k) !== null);
      S.check(`alice: org dashboard ${k || 'registrations'} +1`, k && num(orgStats1, k) === num(orgStats0, k) + 1, k ? `${num(orgStats0, k)} -> ${num(orgStats1, k)}` : JSON.stringify(orgStats1).slice(0, 200));
      const pub = (await L.api(a1, 'GET', '/api/events/ai-in-production-talk')).json;
      S.check('Public event API counter +1', num(pub, 'currentRegistrations') === ai0.cur + 1, '');
      const cross = await L.api(bob, 'GET', `/api/admin/org/${techClub.id}/registrations?eventId=${ai0.id}`);
      S.check('bob (other org) cannot read Tech Club registrations', cross.status === 403 || cross.status === 404, `status=${cross.status}`);
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ door scan of the issued QR
    if (!SKIP.includes('scan')) try {
      S.area('Attendee: the QR on the ticket works at the door');
      const scan = await L.api(alice, 'POST', '/api/tickets/verify', { qrData: reg.ticket.qrCode, eventId: ai0.id });
      S.check('Ticket QR (as issued for a free registration) validates at check-in', scan.json?.data?.valid === true, `qrCode=${reg.ticket.qrCode} -> ${JSON.stringify(scan.json?.data || scan.json).slice(0, 160)}`);
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ ticket dialog
    if (!SKIP.includes('dialog')) try {
      S.area('Attendee: ticket dialog (phone)');
      ph = await L.person(browser, { viewport: L.PHONE });
      await L.loginApi(ph, U1);
      await L.go(ph, '/dashboard/tickets', { settle: 2500 });
      S.check('Phone tickets page: no horizontal overflow', (await L.overflowX(ph)) <= 0, '');
      await L.clickText(ph, /Open ticket for AI in Production/, 'button, a, [role=button]');
      await L.sleep(1200);
      const dlg = await ph.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? { text: d.innerText.replace(/\s+/g, ' '), qr: !!d.querySelector('svg, canvas, img') } : null; });
      S.check('Ticket opens as a dialog with QR, ticket number and actions', dlg && dlg.qr && dlg.text.includes(reg.ticket.ticketNumber) && /Full screen/.test(dlg.text) && /Download PDF/.test(dlg.text) && /Add to calendar/.test(dlg.text) && /Transfer/.test(dlg.text), dlg?.text.slice(0, 200));
      await L.shot(ph, 'att-ticket-dialog-390');
      await L.clickText(ph, /Full screen/, '[role=dialog] button');
      await L.sleep(1000);
      const fs1 = await ph.evaluate(() => { const els = [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); return cs.position === 'fixed' && e.getBoundingClientRect().width >= innerWidth - 1 && e.getBoundingClientRect().height >= innerHeight - 1; }); return els.length ? els[0].innerText.replace(/\s+/g, ' ').slice(0, 120) : null; });
      S.check('Full screen QR covers the screen and shows the ticket number', !!fs1 && fs1.includes(reg.ticket.ticketNumber), String(fs1));
      await ph.screenshot({ path: L.SHOTS + '/att-fullscreen-qr-390.png' });
      await ph.keyboard.press('Escape');
      await L.sleep(800);
      const backToDialog = await ph.evaluate(() => !!document.querySelector('[role=dialog]'));
      S.note('After closing full screen', backToDialog ? 'returns to the ticket dialog' : 'returns to the ticket list (dialog closed)');
      const pdf = await L.api(ph, 'GET', `/api/tickets/${reg.ticket.id}/download`);
      S.check('Download PDF returns a PDF file', pdf.status === 200 && /pdf/.test(pdf.ct) && pdf.head.startsWith('%PDF') && pdf.size > 1000, `${pdf.status} ${pdf.ct} ${pdf.size}B ${pdf.cd}`);
      const ics = await L.api(ph, 'GET', `/api/tickets/${reg.ticket.id}/calendar`);
      const evRow = await db.event.findUnique({ where: { id: ai0.id } });
      const dtstart = evRow.startDate.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      S.check('Add to calendar returns an .ics with the event title and start time', ics.status === 200 && /calendar/.test(ics.ct) && /BEGIN:VCALENDAR/.test(ics.text) && /AI in Production/.test(ics.text) && ics.text.includes(dtstart.slice(0, 13)), `${ics.status} ${ics.ct} DTSTART expected ${dtstart}; got ${(ics.text.match(/DTSTART[^\r\n]*/) || [''])[0]}`);
      other = await L.person(browser);
      await L.loginApi(other, U2);
      const steal = await L.api(other, 'GET', `/api/tickets/${reg.ticket.id}/download`);
      const stealIcs = await L.api(other, 'GET', `/api/tickets/${reg.ticket.id}/calendar`);
      S.check('Another student cannot download this ticket (PDF / ics)', steal.status >= 400 && stealIcs.status >= 400, `${steal.status}/${stealIcs.status}`);
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ transfer
    if (!SKIP.includes('transfer')) try {
      S.area('Attendee: transfer to another student');
      const n1before = await db.notification.count({ where: { userId: u1.id } });
      const n2before = await db.notification.count({ where: { userId: u2.id } });
      await L.go(ph, '/dashboard/tickets', { settle: 2500 });
      await L.clickText(ph, /Open ticket for AI in Production/, 'button, a, [role=button]');
      await L.sleep(1000);
      await L.clickText(ph, /^Transfer$/, '[role=dialog] button');
      await L.sleep(800);
      await L.typeInto(ph, '#transfer-email', U2);
      await L.shot(ph, 'att-transfer-dialog-390');
      const typed = await ph.evaluate(() => document.getElementById('transfer-email')?.value);
      const trResp = ph.waitForResponse(r => r.url().includes('/transfer'), { timeout: 30000 }).catch(() => null);
      const clickedSubmit = await L.clickText(ph, /^Transfer$/, '[role=dialog] button[type=submit]');
      const tr = await trResp;
      await L.sleep(1500);
      const trToast = await L.toasts(ph);
      let trBody = ''; try { trBody = tr ? (await tr.text()).slice(0, 160) : ''; } catch { }
      S.check('Transfer request succeeds', tr && tr.status() === 200, `typed=${typed} clicked=${clickedSubmit} HTTP ${tr && tr.status()} ${trBody} toast=${trToast.join(' | ')}`);
      const oldTicket = await db.ticket.findUnique({ where: { id: reg.ticket.id } });
      const u2tickets = await db.ticket.findMany({ where: { userId: u2.id, eventId: ai0.id } });
      const reg2 = await db.registration.findUnique({ where: { id: reg.id } });
      S.check('Ticket moved to the recipient with a new number (old number retired)', oldTicket.userId === u2.id && oldTicket.ticketNumber !== reg.ticket.ticketNumber, `owner=${oldTicket.userId === u2.id ? 'recipient' : 'sender'} number ${reg.ticket.ticketNumber}->${oldTicket.ticketNumber}`);
      S.check('Recipient owns an ACTIVE ticket and the registration', u2tickets.some(x => x.status === 'ACTIVE') && reg2.userId === u2.id, `tickets=${u2tickets.map(x => x.status)} regOwner=${reg2.userId === u2.id ? 'recipient' : 'sender'}`);
      const oldScan = await L.api(alice, 'POST', '/api/tickets/verify', { qrData: reg.ticket.qrCode, eventId: ai0.id });
      S.check('Old QR no longer admits', oldScan.json?.data?.valid !== true, JSON.stringify(oldScan.json?.data || {}).slice(0, 120));
      await L.go(other, '/dashboard/tickets', { settle: 2500 });
      S.check('Recipient sees the ticket in /dashboard/tickets', /AI in Production/.test(await L.bodyText(other)), '');
      S.check('Both students get a notification', (await db.notification.count({ where: { userId: u1.id } })) > n1before && (await db.notification.count({ where: { userId: u2.id } })) > n2before, '');
      const trCounters = await counters('ai-in-production-talk');
      S.check('Transfer does not change event counters', trCounters.cur === ai1.cur && trCounters.sold['In person'] === ai1.sold['In person'], JSON.stringify(trCounters.sold));
      const badTr = await L.api(a1, 'POST', `/api/tickets/${reg.ticket.id}/transfer`, { recipientEmail: 'not an email' });
      S.check('Transfer to an invalid email is refused with 400', badTr.status === 400, `status=${badTr.status} ${badTr.json?.message || ''}`);
      const strayUser = await db.user.findFirst({ where: { email: 'not an email' } });
      if (strayUser) { S.check('Invalid transfer email does not create a junk account', false, 'user "not an email" was created'); await db.user.delete({ where: { id: strayUser.id } }); }
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ cancel (UI) + seat/stock returned + organizer view
    if (!SKIP.includes('cancel')) try {
      S.area('Attendee: cancel a registration');
      const ca0 = await counters('carnatic-evening');
      const r2 = await L.api(a1, 'POST', '/api/registrations', { eventId: ca0.id, ticketTypeId: ca0.tt['Free entry'], quantity: 1, formResponses: { name: 'E2E-ATT One' } });
      S.check('Register for Carnatic Evening (API)', r2.status === 201, `${r2.status} ${r2.json?.message || ''}`);
      const ca1 = await counters('carnatic-evening');
      S.check('Carnatic counters +1', ca1.cur === ca0.cur + 1 && ca1.sold['Free entry'] === ca0.sold['Free entry'] + 1, '');
      await L.go(ph, '/dashboard/events', { settle: 2500 });
      await L.shot(ph, 'att-my-events-390');
      const cancelBtn = await L.clickText(ph, /Cancel registration for Carnatic/, 'button');
      await L.sleep(800);
      const cdlg = await ph.evaluate(() => document.querySelector('[role=dialog]')?.innerText.replace(/\s+/g, ' '));
      S.check('Cancel asks for confirmation first', cancelBtn && /Cancel this registration\?/.test(cdlg || ''), cdlg);
      await L.shot(ph, 'att-cancel-confirm-390');
      const cResp = ph.waitForResponse(r => r.url().includes('/cancel'), { timeout: 30000 }).catch(() => null);
      await L.clickText(ph, /^Cancel registration$/, '[role=dialog] button');
      await cResp; await L.sleep(800);
      S.check('Cancel shows "Registration cancelled"', (await L.toasts(ph)).some(x => /cancelled/i.test(x)), (await L.toasts(ph)).join(' | '));
      const creg = await db.registration.findUnique({ where: { eventId_userId: { eventId: ca0.id, userId: u1.id } }, include: { ticket: true } });
      S.check('DB: registration and ticket CANCELLED', creg?.status === 'CANCELLED' && creg.ticket?.status === 'CANCELLED', `${creg?.status}/${creg?.ticket?.status}`);
      const ca2 = await counters('carnatic-evening');
      S.check('Seat and ticket stock returned', ca2.cur === ca0.cur && ca2.sold['Free entry'] === ca0.sold['Free entry'], `cur ${ca0.cur}->${ca1.cur}->${ca2.cur} sold ${ca0.sold['Free entry']}->${ca2.sold['Free entry']}`);
      const bobList = JSON.stringify((await L.api(bob, 'GET', `/api/admin/org/${cultural.id}/registrations?eventId=${ca0.id}&search=e2e-att-1`)).json || {});
      S.check('Organizer (bob) sees it as CANCELLED', bobList.includes(U1) && /CANCELLED/.test(bobList), '');
      t = await L.bodyText(ph);
      const stillCancellable = await ph.evaluate(() => !![...document.querySelectorAll('button[aria-label^="Cancel registration for Carnatic"]')].length);
      S.check('My events: no cancel button left on the cancelled row', !stillCancellable, '');
      await L.go(ph, '/dashboard/tickets', { settle: 2500 });
      t = await L.bodyText(ph);
      S.check('Cancelled ticket is gone from Upcoming tickets', !/Carnatic Evening/.test(t.split(/Past \(/)[0]), '');
      const again = await L.api(a1, 'POST', '/api/registrations', { eventId: ca0.id, ticketTypeId: ca0.tt['Free entry'], quantity: 1, formResponses: { name: 'E2E-ATT One' } });
      S.check('Can register again after cancelling (same ticket comes back to life)', again.status === 201 && again.json?.data?.ticket?.status === 'ACTIVE', `${again.status} ${again.json?.message || ''}`);
      const againCancel = await L.api(a1, 'POST', `/api/registrations/${creg.id}/cancel`);
      const dbl = await L.api(a1, 'POST', `/api/registrations/${creg.id}/cancel`);
      const ca3 = await counters('carnatic-evening');
      S.check('Cancel again via API; a second cancel is refused and counters stay exact', againCancel.status === 200 && dbl.status === 400 && ca3.cur === ca0.cur && ca3.sold['Free entry'] === ca0.sold['Free entry'], `cancel=${againCancel.status} ${againCancel.json?.message || ""} second=${dbl.status} cur=${ca3.cur} sold=${ca3.sold["Free entry"]}`);
      const notMine = await L.api(other, 'POST', `/api/registrations/${creg.id}/cancel`);
      S.check('Another student cannot cancel it (403)', notMine.status === 403, `status=${notMine.status}`);
      const past = await db.registration.findFirst({ where: { user: { email: 'carol@test.local' }, event: { slug: 'tech-club-orientation' } } });
      if (past) { const late = await L.api(a1, 'POST', `/api/registrations/${past.id}/cancel`); S.check('Cancelling someone else\'s registration on a started event is refused', late.status === 403, `status=${late.status}`); }
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ paid ticket: payments not configured, 15-min hold
    if (!SKIP.includes('paid')) try {
      S.area('Attendee: paid ticket with payments not configured');
      const ru0 = await counters('rust-systems-workshop');
      await uiRegister(a1, 'rust-systems-workshop', /Standard/);
      const held = await L.waitText(a1, /Almost done/i, 30000);
      await L.sleep(3000);
      t = await L.bodyText(a1);
      S.check('Pay -> "Almost done — complete your payment"', held, '');
      S.check('Says online payment is unavailable and the seat is held until a time', /Online payment isn.t available/i.test(t) && /held/i.test(t) && /\d{1,2}:\d{2}/.test(t), (t.match(/Online payment[^\n]*/) || [''])[0]);
      await L.shot(a1, 'att-paid-hold-1440');
      const preg = await db.registration.findUnique({ where: { eventId_userId: { eventId: ru0.id, userId: u1.id } }, include: { payment: true } });
      const hold = preg?.metadata?.holdExpiresAt ? (new Date(preg.metadata.holdExpiresAt) - new Date(preg.createdAt)) / 60000 : null;
      S.check('DB: PENDING registration with a ~15-minute hold and a pending payment', preg?.status === 'PENDING' && hold > 14 && hold <= 15.1 && preg.payment && ['PENDING', 'PROCESSING'].includes(preg.payment.status), `status=${preg?.status} hold=${hold && hold.toFixed(1)}min payment=${preg?.payment?.status}`);
      const ru1 = await counters('rust-systems-workshop');
      S.check('Held seat counts: event +1, Standard stock +1', ru1.cur === ru0.cur + 1 && ru1.sold.Standard === ru0.sold.Standard + 1, `cur ${ru0.cur}->${ru1.cur} std ${ru0.sold.Standard}->${ru1.sold.Standard}`);
      const co = await L.api(a1, 'POST', '/api/payments/create-order', { registrationId: preg.id });
      S.check('create-order -> 503 "payments not configured"', co.status === 503, `${co.status} ${co.json?.message}`);
      await L.go(a1, '/dashboard/events', { settle: 2500 });
      t = await L.bodyText(a1);
      S.check('My events shows the held registration as pending payment', /Rust for Systems/.test(t) && /(Pending|Awaiting|payment)/i.test(t), '');
      await L.go(a1, '/dashboard/tickets', { settle: 2000 });
      S.note('Held (unpaid) registration on /dashboard/tickets', /Rust for Systems/.test(await L.bodyText(a1)) ? 'listed' : 'not listed (no ticket until paid)');
      await L.go(a1, '/events/rust-systems-workshop', { settle: 1500 });
      S.note('Event page while the hold is active', (await L.bodyText(a1)).match(/(Registered|Pending|Complete (your )?payment|View my ticket|Register)[^\n]*/i)?.[0] || '');
      await L.go(a1, '/dashboard/events', { settle: 2500 });
      const uiRelease = await L.clickText(a1, /(Cancel registration|Release held seat) for Rust/, 'button');
      S.check('The held registration can be released from the UI (My events -> cancel)', uiRelease, uiRelease ? '' : 'no cancel control for the held registration anywhere in the dashboard');
      if (uiRelease) {
        await L.sleep(800);
        await L.clickText(a1, /^(Cancel registration|Release seat)$/, '[role=dialog] button');
        await L.sleep(2500);
      } else {
        const apiRelease = await L.api(a1, 'POST', `/api/registrations/${preg.id}/cancel`);
        S.note('Hold released through the API instead', `${apiRelease.status} ${apiRelease.json?.message}`);
      }
      const preg2 = await db.registration.findUnique({ where: { id: preg.id }, include: { payment: true } });
      const ru2 = await counters('rust-systems-workshop');
      S.check('Releasing the hold (cancel): CANCELLED, payment FAILED, seat and stock back', preg2.status === 'CANCELLED' && preg2.payment?.status === 'FAILED' && ru2.cur === ru0.cur && ru2.sold.Standard === ru0.sold.Standard, `status=${preg2.status} pay=${preg2.payment?.status} cur=${ru2.cur} std=${ru2.sold.Standard}`);
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ saved events
    if (!SKIP.includes('saved')) try {
      S.area('Attendee: save / unsave');
      const g = await L.person(browser);
      await L.go(g, '/events/utsav-2026', { settle: 1500 });
      await L.clickText(g, /Save for later/, 'button');
      await L.sleep(2000);
      S.check('Guest pressing Save is sent to log in (and back)', /\/login\?callbackUrl=%2Fevents%2Futsav-2026/.test(g.url()), g.url());
      await g.ctx.close();
      await L.go(a1, '/events/utsav-2026', { settle: 1500 });
      await L.clickText(a1, /Save for later/, 'button');
      await L.sleep(1500);
      S.check('Save shows "Saved to your list" and flips to "Remove from saved"', (await L.toasts(a1)).some(x => /Saved/i.test(x)) && await a1.evaluate(() => !!document.querySelector('[aria-label="Remove from saved"]')), (await L.toasts(a1)).join(' | '));
      await L.go(a1, '/dashboard/saved', { settle: 2000 });
      S.check('/dashboard/saved lists Utsav', /Utsav 2026/.test(await L.bodyText(a1)), '');
      await L.shot(a1, 'att-saved-1440');
      await L.go(a1, '/events/utsav-2026', { settle: 1500 });
      S.check('Saved state persists on the event page after reload', await a1.evaluate(() => !!document.querySelector('[aria-label="Remove from saved"]')), '');
      await L.clickText(a1, /Remove from saved/, 'button');
      await L.sleep(1500);
      await L.go(a1, '/dashboard/saved', { settle: 2000 });
      S.check('Unsave removes it from /dashboard/saved', !/Utsav 2026/.test(await L.bodyText(a1)), '');
      const saveDraft = await L.api(a1, 'POST', '/api/users/me/saved-events', { eventId: (await db.event.findUnique({ where: { slug: 'open-source-sprint-2027' } })).id });
      S.check('Saving a DRAFT event by id is refused', saveDraft.status >= 400, `status=${saveDraft.status}`);
      await db.savedEvent.deleteMany({ where: { userId: u1.id } });
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ notifications
    if (!SKIP.includes('notifications')) try {
      S.area('Attendee: notifications');
      await db.notification.createMany({ data: [1, 2, 3].map(i => ({ userId: u1.id, type: 'IN_APP', category: 'SYSTEM', title: `E2E-ATT note ${i}`, message: `E2E-ATT test notification ${i}` })) });
      await L.go(ph, '/dashboard/notifications', { settle: 2500 });
      const unread0 = num((await L.api(ph, 'GET', '/api/notifications/unread-count')).json, 'count');
      const dots = await ph.evaluate(() => document.querySelectorAll('[aria-label=Unread]').length);
      S.check('Unread notifications are marked on the page', dots >= 3 && unread0 >= 3, `dots=${dots} unread=${unread0}`);
      await L.shot(ph, 'att-notifications-390');
      await L.clickText(ph, /Mark all as read/, 'button');
      await L.sleep(1500);
      const unread1 = num((await L.api(ph, 'GET', '/api/notifications/unread-count')).json, 'count');
      const dots1 = await ph.evaluate(() => document.querySelectorAll('[aria-label=Unread]').length);
      S.check('Mark all as read: dots gone and unread count 0', unread1 === 0 && dots1 === 0, `unread=${unread1} dots=${dots1}`);
      const nBefore = await db.notification.count({ where: { userId: u1.id } });
      await L.clickText(ph, /Delete notification: E2E-ATT note 2/, 'button');
      await L.sleep(1500);
      await L.go(ph, '/dashboard/notifications', { settle: 2000 });
      S.check('Delete removes the notification (after reload too)', !/E2E-ATT note 2/.test(await L.bodyText(ph)) && (await db.notification.count({ where: { userId: u1.id } })) === nBefore - 1, '');
      const n2 = await db.notification.findFirst({ where: { userId: u2.id } }) || await db.notification.create({ data: { userId: u2.id, type: 'IN_APP', category: 'SYSTEM', title: 'E2E-ATT other', message: 'E2E-ATT other' } });
      const delOther = await L.api(ph, 'DELETE', `/api/notifications/${n2.id}`);
      S.check('Cannot delete another user\'s notification', !!(await db.notification.findUnique({ where: { id: n2.id } })), `status=${delOther.status}`);
      S.check('Deleting a notification that is not yours answers 404 (not 200 "deleted")', delOther.status === 404 || delOther.status === 403, `status=${delOther.status} ${JSON.stringify(delOther.json)}`);
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ profile
    if (!SKIP.includes('profile')) try {
      S.area('Attendee: profile');
      await L.go(ph, '/dashboard/profile', { settle: 2000 });
      await L.typeInto(ph, '#p-name', 'E2E-ATT One Edited');
      await L.typeInto(ph, '#p-city', 'Bengaluru');
      await L.typeInto(ph, '#p-bio', 'E2E bio line');
      await L.typeInto(ph, '#p-college', 'E2E Updated College');
      await L.clickText(ph, /^Save( changes| profile)?$/, 'button');
      await L.sleep(1500);
      S.check('Save shows "Profile updated"', (await L.toasts(ph)).some(x => /Profile updated/i.test(x)), (await L.toasts(ph)).join(' | '));
      await L.go(ph, '/dashboard/profile', { settle: 2000 });
      const prof = await ph.evaluate(() => ['p-name', 'p-city', 'p-bio', 'p-college'].map(id => document.getElementById(id)?.value));
      S.check('Profile edits persist after reload', prof[0] === 'E2E-ATT One Edited' && prof[1] === 'Bengaluru' && prof[2] === 'E2E bio line' && prof[3] === 'E2E Updated College', JSON.stringify(prof));
      const sessName = (await L.api(ph, 'GET', '/api/auth/session')).json?.user?.name;
      await L.go(ph, '/dashboard', { settle: 1500 });
      S.note('Header/greeting after a name change', `session name="${sessName}"; dashboard greets: ${(await L.bodyText(ph)).match(/(Hi|Hello|Good \w+|Welcome)[^\n]*/)?.[0]}`);
      await L.go(ph, '/dashboard/profile', { settle: 2000 });
      await L.typeInto(ph, '#p-name', '');
      await L.clickText(ph, /^Save( changes| profile)?$/, 'button');
      await L.sleep(1500);
      S.check('Empty name is refused', (await L.toasts(ph)).some(x => /Name is required|required/i.test(x)), (await L.toasts(ph)).join(' | '));
  
    } catch (e) { S.check('section crashed', false, e.stack); }
    // ------------------------------------------------------------------ settings: preferences + password
    if (!SKIP.includes('settings')) try {
      S.area('Attendee: settings');
      await L.go(ph, '/dashboard/settings', { settle: 2000 });
      const sw = await ph.evaluate(() => [...document.querySelectorAll('[role=switch]')].map(s => ({ label: s.getAttribute('aria-label'), on: s.getAttribute('aria-checked'), dis: s.hasAttribute('disabled') || s.getAttribute('aria-disabled') === 'true' || s.hasAttribute('data-disabled') })));
      S.check('Notification preference switches are labelled', sw.length > 0 && sw.every(s => s.label), JSON.stringify(sw.slice(0, 4)));
      const target = sw.find(s => !s.dis) || sw[0]; // the first rows are 'Required' (locked on)
      await ph.click(`[role=switch][aria-label="${target.label}"]`);
      await L.sleep(400);
      const mid = await ph.evaluate(l => document.querySelector(`[role=switch][aria-label="${l}"]`)?.getAttribute('aria-checked'), target.label);
      S.check('Clicking a preference switch flips it', mid !== target.on, `${target.on} -> ${mid}`);
      await L.clickText(ph, /Save preferences/, 'button');
      await L.sleep(1500);
      S.check('Save preferences shows "Preferences saved"', (await L.toasts(ph)).some(x => /Preferences saved/i.test(x)), (await L.toasts(ph)).join(' | '));
      await L.go(ph, '/dashboard/settings', { settle: 2000 });
      const after = await ph.evaluate(l => document.querySelector(`[role=switch][aria-label="${l}"]`)?.getAttribute('aria-checked'), target.label);
      S.check(`Preference "${target.label}" persists after reload`, after !== target.on, `${target.on} -> ${after}`);
      await L.shot(ph, 'att-settings-390');
      // password change keeps this device signed in, other device signed out
      const otherDevice = await L.person(browser);
      await L.loginApi(otherDevice, U1);
      await L.sleep(1500);
      await L.clickText(ph, /Change password/, 'button');
      await L.sleep(500);
      const NEWP = 'E2eAtt@Changed7';
      await L.typeInto(ph, '#pw-current', PASS);
      await L.typeInto(ph, '#pw-new', NEWP);
      await L.typeInto(ph, '#pw-confirm', NEWP);
      await L.clickText(ph, /^Update password$/, 'button');
      await L.sleep(5000);
      const pwT = await L.toasts(ph);
      S.check('Password change succeeds and says other devices will be signed out', pwT.some(x => /Other devices will be signed out/i.test(x)), pwT.join(' | '));
      await L.go(ph, '/dashboard/settings', { settle: 1500 });
      S.check('This device stays signed in after the change (reload)', (await L.api(ph, 'GET', '/api/auth/session')).json?.user?.email === U1 && /\/dashboard\/settings/.test(ph.url()), ph.url());
      const pwFresh = await L.person(browser);
      S.check('New password signs in; old one does not', (await L.loginApi(pwFresh, U1, PASS)) === null && (await L.loginApi(pwFresh, U1, NEWP)) === U1, '');
      await pwFresh.ctx.close();
      let otherOut = null;
      const polls = process.env.LONG ? 75 : 4; // LONG=1 waits up to ~6 min: sessions re-check the account every 5 min (src/lib/auth.ts)
      for (let i = 0; i < polls; i++) { const s = (await L.api(otherDevice, 'GET', '/api/auth/session')).json; if (!s?.user) { otherOut = true; break; } otherOut = false; await L.sleep(5000); }
      if (otherOut || process.env.LONG) S.check('A device signed in before the change is signed out', otherOut === true, otherOut ? '' : 'still signed in after ~6 min');
      else S.note('Other device after a password change', 'still signed in after 20s; sessions only re-check every 5 min. Run with LONG=1 to wait for it');
      const wrongCur = await L.api(ph, 'POST', '/api/auth/change-password', { currentPassword: 'Nope@12345', newPassword: 'E2eAtt@Other12' });
      S.check('Wrong current password is refused', wrongCur.status === 400 && /incorrect/i.test(wrongCur.json?.message || ''), wrongCur.json?.message);
      await otherDevice.ctx.close();
    } catch (e) { S.check('section crashed', false, e.stack); }
    if (ph) await ph.ctx.close(); if (other) await other.ctx.close();
    } catch (e) {
      S.check('script crashed', false, e.stack);
    } finally {
      await browser.close();
      await db.$disconnect();
    }
    process.exitCode = S.finish() ? 1 : 0;
  })();
  