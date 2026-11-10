// Paid-ticket flows with simulated ("fake") money: no Razorpay account needed.
//
// Razorpay is replaced at the two points where it talks to us:
//   1. the order it would create -> we write a fake gatewayOrderId on the Payment row
//      (exactly what /api/payments/create-order stores after Razorpay answers);
//   2. its success callback / webhooks -> we sign them with local test secrets, the same
//      HMAC-SHA256 Razorpay uses, and POST them to /api/payments/verify and
//      /api/webhooks/razorpay.
// Everything after that is the real app: seat holds, coupon, ticket issue, refunds, cron,
// notifications, emails, organizer revenue, invoices.
//
// Needs in D:\eventflow\.env (local values, any random strings; NOT real keys):
//   RAZORPAY_KEY_SECRET=...      RAZORPAY_WEBHOOK_SECRET=...      CRON_SECRET=...
// and RAZORPAY_KEY_ID left EMPTY (so create-order answers 503 and never calls Razorpay).
// Optional: a mail catcher on localhost:1025 with a JSON inbox at http://localhost:8025/messages.
//
// Run: node e2e/attendee/06-payments-sim.cjs      (cleans up after itself)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const { db } = L;

const env = fs.readFileSync(path.join(L.ROOT, '.env'), 'utf8');
const envVal = k => ((env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm')) || [])[1] || '').trim();
const KEY_SECRET = envVal('RAZORPAY_KEY_SECRET');
const WEBHOOK_SECRET = envVal('RAZORPAY_WEBHOOK_SECRET');
const CRON_SECRET = envVal('CRON_SECRET');
const KEY_ID = envVal('RAZORPAY_KEY_ID');

const S = L.suite('06-payments-sim');
const USERS = ['e2e-att-pay1@test.local', 'e2e-att-pay2@test.local', 'e2e-att-pay3@test.local', 'e2e-att-pay4@test.local'];
const COUPON = 'E2EPAY20';
const SLUG = process.env.PAY_EVENT || 'rust-systems-workshop'; // a paid event whose registration is open
const rid = p => p + '_E2E' + crypto.randomBytes(6).toString('hex');
const sigPay = (o, p) => crypto.createHmac('sha256', KEY_SECRET).update(`${o}|${p}`).digest('hex');

async function webhook(body, { badSig = false } = {}) {
  const raw = JSON.stringify(body);
  const sig = badSig ? 'f'.repeat(64) : crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
  const r = await fetch(L.BASE + '/api/webhooks/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body: raw });
  let json = null; try { json = await r.json(); } catch { }
  return { status: r.status, json };
}
async function inbox() {
  // Subjects arrive MIME-encoded (=?UTF-8?Q?...?= / =?UTF-8?B?...?=): decode them
  const dec = (h) => String(h || '').replace(/=\?UTF-8\?([QB])\?([^?]*)\?=\s*/gi, (_, enc, txt) => enc.toUpperCase() === 'B'
    ? Buffer.from(txt, 'base64').toString('utf8')
    : Buffer.from(txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (__, x) => String.fromCharCode(parseInt(x, 16))), 'latin1').toString('utf8'));
  try { return (await (await fetch('http://localhost:8025/messages', { signal: AbortSignal.timeout(3000) })).json()).map(m => ({ ...m, subject: dec(m.subject) })); } catch { return null; }
}
async function state(eventId) {
  const e = await db.event.findUnique({ where: { id: eventId }, select: { currentRegistrations: true, ticketTypes: { select: { name: true, sold: true } } } });
  return { cur: e.currentRegistrations, sold: Object.fromEntries(e.ticketTypes.map(t => [t.name, t.sold])) };
}
async function regOf(eventId, email) {
  return db.registration.findFirst({ where: { eventId, user: { email } }, include: { payment: true, ticket: true } });
}
async function register(page, eventId, ticketTypeId, couponCode) {
  return L.api(page, 'POST', '/api/registrations', { eventId, ticketTypeId, quantity: 1, formResponses: {}, ...(couponCode ? { couponCode } : {}) });
}

(async () => {
  if (!(await L.serverUp())) { console.error('Dev server not reachable at ' + L.BASE); process.exit(2); }
  if (!KEY_SECRET || !WEBHOOK_SECRET) { console.error('Set local RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET in .env first (see header).'); process.exit(2); }
  if (KEY_ID) S.note('RAZORPAY_KEY_ID is set', 'create-order will call the real Razorpay test API');

  const ev = await db.event.findUnique({ where: { slug: SLUG }, select: { id: true, title: true, organizationId: true, ticketTypes: { select: { id: true, name: true, price: true } } } });
  // two paid ticket types: the dearer one is "day" (coupon, failure, expiry), the other "fest" (webhook + refund)
  const paidTypes = ev.ticketTypes.filter(t => Number(t.price) > 0).sort((a, b) => Number(b.price) - Number(a.price));
  const day = paidTypes[0], fest = paidTypes[1] || paidTypes[0];
  const P = Number(day.price), F = Number(fest.price), r2 = n => Math.round(n * 100) / 100;
  const DISC = r2(P * 0.2), PAY1 = r2(P - DISC);
  const orgAdmin = await db.organizationMember.findFirst({ where: { organizationId: ev.organizationId, role: 'ORG_ADMIN', user: { email: { endsWith: '@test.local' } } }, select: { user: { select: { email: true } } } });
  const before = await state(ev.id);
  const mail0 = (await inbox())?.length ?? null;
  S.note('Start', `event cur=${before.cur} sold=${JSON.stringify(before.sold)} organizer=${orgAdmin?.user.email} mail-catcher=${mail0 === null ? 'off' : 'on'}`);

  await L.purgeUsers(USERS);
  await db.coupon.deleteMany({ where: { code: COUPON } });
  const u = {};
  for (const [i, e] of USERS.entries()) u[i + 1] = await L.ensureUser(e, `E2E Payer ${i + 1}`);
  const now = Date.now();
  await db.coupon.create({ data: { code: COUPON, eventId: ev.id, discountType: 'PERCENTAGE', discountValue: 20, maxUses: 5, validFrom: new Date(now - 864e5), validUntil: new Date(now + 7 * 864e5) } });

  const browser = await L.launch();
  try {
    const p1 = await L.person(browser), p2 = await L.person(browser), p3 = await L.person(browser), p4 = await L.person(browser);
    for (const [p, e] of [[p1, USERS[0]], [p2, USERS[1]], [p3, USERS[2]], [p4, USERS[3]]]) S.check(`sign in ${e}`, (await L.loginApi(p, e)) === e);

    // ------------------------------------------------------------ A. checkout success (buyer's browser callback) + coupon
    S.area('A. Paid ticket + 20% coupon, paid through the checkout callback');
    const cv = await L.api(p1, 'POST', '/api/coupons/validate', { code: COUPON, eventId: ev.id, ticketTypeId: day.id, quantity: 1 });
    S.check('Coupon validates and shows the discount', cv.status === 200 && Number(cv.json?.data?.discount) === DISC, `${cv.status} ${JSON.stringify(cv.json).slice(0, 200)}`);
    const bad = await L.api(p1, 'POST', '/api/coupons/validate', { code: 'NOPE-E2E', eventId: ev.id, ticketTypeId: day.id, quantity: 1 });
    S.check('Unknown coupon is rejected by validate', bad.status >= 400 || bad.json?.success === false, `${bad.status} ${bad.json?.message}`);
    const r1 = await register(p1, ev.id, day.id, COUPON);
    S.check(`Register (${day.name} ₹${P}, coupon) -> 2xx`, r1.status < 300, `${r1.status} ${r1.json?.message}`);
    let g1 = await regOf(ev.id, USERS[0]);
    const s1 = await state(ev.id);
    S.check(`Registration PENDING with a seat hold; payment PENDING ₹${PAY1} (₹${DISC} off)`, g1?.status === 'PENDING' && g1.payment?.status === 'PENDING' && Number(g1.payment.amount) === PAY1 && Number(g1.payment.discountAmount) === DISC, `reg=${g1?.status} pay=${g1?.payment?.status} amt=${g1?.payment?.amount} disc=${g1?.payment?.discountAmount}`);
    S.check('Hold counts once: seat +1, ticket stock +1', s1.cur === before.cur + 1 && s1.sold[day.name] === before.sold[day.name] + 1, `${before.cur}->${s1.cur}`);
    const c1 = await db.coupon.findUnique({ where: { code: COUPON } });
    S.check('Coupon use counted (1)', c1.currentUses === 1, `uses=${c1.currentUses}`);
    const co = await L.api(p1, 'POST', '/api/payments/create-order', { registrationId: g1.id });
    S.check('create-order without a gateway key -> 503 (never fakes an order)', co.status === 503, `${co.status} ${co.json?.message}`);
    const co2 = await L.api(p2, 'POST', '/api/payments/create-order', { registrationId: g1.id });
    S.check("Someone else can't open checkout for this registration (404)", co2.status === 404, `${co2.status}`);

    // Razorpay "creates" the order
    const order1 = rid('order'), pay1 = rid('pay');
    await db.payment.update({ where: { id: g1.payment.id }, data: { gatewayOrderId: order1 } });
    const v0 = await L.api(p1, 'POST', '/api/payments/verify', { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: 'a'.repeat(64) });
    S.check('Forged signature -> 400, nothing confirmed', v0.status === 400 && (await regOf(ev.id, USERS[0])).status === 'PENDING', `${v0.status} ${v0.json?.message}`);
    const vX = await L.api(p2, 'POST', '/api/payments/verify', { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: sigPay(order1, pay1) });
    S.check("A valid signature replayed by another user -> 404 (can't claim someone else's payment)", vX.status === 404, `${vX.status} ${vX.json?.message}`);
    const v1 = await L.api(p1, 'POST', '/api/payments/verify', { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: sigPay(order1, pay1) });
    S.check('Genuine (signed) success -> 200 with a ticket', v1.status === 200 && v1.json?.data?.ticket?.ticketNumber, `${v1.status} ${v1.json?.message} ticket=${v1.json?.data?.ticket?.ticketNumber}`);
    g1 = await regOf(ev.id, USERS[0]);
    const s2 = await state(ev.id);
    S.check('DB: registration CONFIRMED, payment COMPLETED with paidAt + gateway payment id, ticket issued', g1.status === 'CONFIRMED' && g1.payment.status === 'COMPLETED' && g1.payment.paidAt && g1.payment.gatewayPaymentId === pay1 && g1.ticket, `reg=${g1.status} pay=${g1.payment.status} ticket=${g1.ticket?.ticketNumber}`);
    S.check('Seat not double-counted on payment', s2.cur === s1.cur && s2.sold[day.name] === s1.sold[day.name], `${s1.cur}->${s2.cur}`);
    const v2 = await L.api(p1, 'POST', '/api/payments/verify', { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: sigPay(order1, pay1) });
    const s3 = await state(ev.id);
    S.check('Replaying the callback is harmless (200, counters unchanged)', v2.status === 200 && s3.cur === s2.cur, `${v2.status} ${v2.json?.message}`);
    const wDup = await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: pay1, order_id: order1, amount: Math.round(PAY1 * 100), currency: 'INR', status: 'captured' } } } });
    S.check('Late payment.captured webhook for the same payment is harmless', wDup.status === 200 && (await state(ev.id)).cur === s2.cur, `${wDup.status}`);
    const n1 = await db.notification.findMany({ where: { userId: u[1].id }, select: { title: true, message: true } });
    S.check('Buyer gets in-app notifications (payment + confirmation)', n1.length >= 1, n1.map(n => n.title).join(' | '));

    // What the buyer sees
    await L.go(p1, '/dashboard/tickets', { settle: 2500 });
    let t = await L.bodyText(p1);
    S.check('Buyer: ticket listed on /dashboard/tickets', new RegExp(ev.title.slice(0, 12), 'i').test(t), '');
    await L.go(p1, '/dashboard/payments', { settle: 2500 });
    t = await L.bodyText(p1);
    S.check(`Buyer: payment listed on /dashboard/payments with ₹${PAY1}`, t.toLowerCase().includes(ev.title.slice(0, 12).toLowerCase()) && t.includes(String(Math.floor(PAY1))), t.split('\n').find(l => l.includes(String(Math.floor(PAY1)))) || '');
    await L.shot(p1, 'pay-buyer-payments');
    const pdf = await L.api(p1, 'GET', `/api/tickets/${g1.ticket.id}/download`);
    S.check('Buyer: ticket PDF downloads', pdf.status === 200 && pdf.head.startsWith('%PDF'), `${pdf.status} ${pdf.ct}`);
    const inv = await L.api(p1, 'GET', `/api/payments/${g1.payment.id}/invoice`);
    S.check('Buyer: invoice/receipt available', inv.status === 200, `${inv.status} ${inv.ct} ${inv.json?.message || ''}`);
    const invX = await L.api(p2, 'GET', `/api/payments/${g1.payment.id}/invoice`);
    S.check("Another user can't read this invoice", invX.status === 403 || invX.status === 404, `${invX.status}`);

    // ------------------------------------------------------------ B. webhook-only success (buyer closed the tab), then refund
    S.area('B. Paid through the webhook only (tab closed), then refunded in Razorpay');
    const r2 = await register(p2, ev.id, fest.id);
    S.check(`Register (${fest.name} ₹${F}) -> 2xx`, r2.status < 300, `${r2.status} ${r2.json?.message}`);
    let g2 = await regOf(ev.id, USERS[1]);
    const order2 = rid('order'), pay2 = rid('pay');
    await db.payment.update({ where: { id: g2.payment.id }, data: { gatewayOrderId: order2 } });
    const wb = await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: pay2, order_id: order2, amount: Math.round(F * 100) } } } }, { badSig: true });
    S.check('Webhook with a bad signature -> 400', wb.status === 400, `${wb.status}`);
    const wm = await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: pay2, order_id: order2, amount: 100 } } } });
    g2 = await regOf(ev.id, USERS[1]);
    S.check('Webhook for the wrong amount (₹1) does NOT confirm', wm.status === 200 && g2.status === 'PENDING' && g2.payment.status !== 'COMPLETED', `${wm.status} reg=${g2.status} pay=${g2.payment.status}`);
    const sB0 = await state(ev.id);
    const wc = await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: pay2, order_id: order2, amount: Math.round(F * 100), currency: 'INR' } } } });
    g2 = await regOf(ev.id, USERS[1]);
    S.check('payment.captured -> CONFIRMED + ticket without the buyer\'s browser', wc.status === 200 && g2.status === 'CONFIRMED' && g2.payment.status === 'COMPLETED' && g2.ticket, `${wc.status} reg=${g2.status} pay=${g2.payment.status}`);
    S.check('Seat not double-counted', (await state(ev.id)).cur === sB0.cur, '');
    const orgPay0 = await L.api(p1, 'GET', `/api/admin/org/${ev.organizationId}/payments`);
    S.check("A buyer can't open the organizer's payments API", orgPay0.status === 403, `${orgPay0.status}`);
    const rf = await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: rid('rfnd'), payment_id: pay2, amount: Math.round(F * 100) } }, payment: { entity: { id: pay2, order_id: order2, amount: Math.round(F * 100), amount_refunded: Math.round(F * 100) } } } });
    g2 = await regOf(ev.id, USERS[1]);
    const sB1 = await state(ev.id);
    S.check('refund.processed -> payment REFUNDED, registration cancelled, ticket no longer valid', rf.status === 200 && g2.payment.status === 'REFUNDED' && g2.status === 'CANCELLED' && (!g2.ticket || g2.ticket.status !== 'ACTIVE'), `${rf.status} pay=${g2.payment.status} reg=${g2.status} ticket=${g2.ticket?.status}`);
    S.check('Refund frees the seat and the ticket stock', sB1.cur === sB0.cur - 1 && sB1.sold[fest.name] === sB0.sold[fest.name] - 1, `cur ${sB0.cur}->${sB1.cur} ${fest.name} ${sB0.sold[fest.name]}->${sB1.sold[fest.name]}`);
    const rf2 = await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: rid('rfnd'), payment_id: pay2, amount: Math.round(F * 100) } }, payment: { entity: { id: pay2, order_id: order2, amount: Math.round(F * 100), amount_refunded: Math.round(F * 100) } } } });
    S.check('A second refund webhook changes nothing', rf2.status === 200 && (await state(ev.id)).cur === sB1.cur, '');

    // ------------------------------------------------------------ C. payment fails, buyer retries later and pays
    S.area('C. Payment fails, seat goes back; a late success re-claims it');
    await register(p3, ev.id, day.id);
    let g3 = await regOf(ev.id, USERS[2]);
    const order3 = rid('order'), pay3 = rid('pay');
    await db.payment.update({ where: { id: g3.payment.id }, data: { gatewayOrderId: order3 } });
    const sC0 = await state(ev.id);
    const wf = await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: pay3, order_id: order3, error_description: 'Card declined (E2E)' } } } });
    g3 = await regOf(ev.id, USERS[2]);
    const sC1 = await state(ev.id);
    S.check('payment.failed -> payment FAILED with the reason, seat released', wf.status === 200 && g3.payment.status === 'FAILED' && /declined/i.test(g3.payment.failureReason || '') && sC1.cur === sC0.cur - 1, `${wf.status} pay=${g3.payment.status} cur ${sC0.cur}->${sC1.cur}`);
    await L.go(p3, '/dashboard/events', { settle: 2500 });
    S.note('Buyer view after a failed payment (/dashboard/events)', ((await L.bodyText(p3)).split('\n').find(l => l.toLowerCase().includes(ev.title.slice(0, 12).toLowerCase())) || '').trim());
    const pay3b = rid('pay');
    const v3 = await L.api(p3, 'POST', '/api/payments/verify', { razorpay_order_id: order3, razorpay_payment_id: pay3b, razorpay_signature: sigPay(order3, pay3b) });
    g3 = await regOf(ev.id, USERS[2]);
    S.check('A retry that succeeds re-claims a seat -> CONFIRMED + ticket', v3.status === 200 && g3.status === 'CONFIRMED' && g3.ticket, `${v3.status} ${v3.json?.message} reg=${g3.status}`);
    S.check('Seat counted again (+1)', (await state(ev.id)).cur === sC1.cur + 1, '');

    // ------------------------------------------------------------ D. 15-minute hold runs out
    S.area('D. Unpaid hold expires (cron), late payment still honoured');
    await register(p4, ev.id, day.id);
    let g4 = await regOf(ev.id, USERS[3]);
    const order4 = rid('order'), pay4 = rid('pay');
    await db.payment.update({ where: { id: g4.payment.id }, data: { gatewayOrderId: order4 } });
    await db.registration.update({ where: { id: g4.id }, data: { metadata: { ...(g4.metadata || {}), holdExpiresAt: new Date(Date.now() - 60000).toISOString() } } });
    const sD0 = await state(ev.id);
    const cronNo = await fetch(L.BASE + '/api/cron/release-holds');
    S.check('Cron without the secret -> 401', cronNo.status === 401, `${cronNo.status}`);
    const cron = await fetch(L.BASE + '/api/cron/release-holds', { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    const cj = await cron.json().catch(() => ({}));
    g4 = await regOf(ev.id, USERS[3]);
    const sD1 = await state(ev.id);
    S.check('Cron releases the expired hold: seat and stock back', cron.status === 200 && cj.data?.released >= 1 && sD1.cur === sD0.cur - 1 && sD1.sold[day.name] === sD0.sold[day.name] - 1, `${cron.status} released=${cj.data?.released} cur ${sD0.cur}->${sD1.cur}`);
    const v4 = await L.api(p4, 'POST', '/api/payments/verify', { razorpay_order_id: order4, razorpay_payment_id: pay4, razorpay_signature: sigPay(order4, pay4) });
    g4 = await regOf(ev.id, USERS[3]);
    S.check('Money arriving after the hold ran out is still honoured (seat free) -> CONFIRMED', v4.status === 200 && g4.status === 'CONFIRMED' && g4.ticket, `${v4.status} ${v4.json?.message} reg=${g4.status}`);

    // ------------------------------------------------------------ E. organizer side
    S.area('E. Organizer sees the money');
    const orgP = await L.person(browser);
    S.check(`Organizer ${orgAdmin.user.email} signs in`, (await L.loginApi(orgP, orgAdmin.user.email, L.DEMO_PASS)) === orgAdmin.user.email);
    const op = await L.api(orgP, 'GET', `/api/admin/org/${ev.organizationId}/payments?limit=100`);
    const opText = JSON.stringify(op.json || {});
    S.check('Org payments API lists the e2e payments', op.status === 200 && opText.includes(g1.payment.paymentNumber) && opText.includes(g2.payment.paymentNumber), `${op.status}`);
    // Collected = every payment that was paid (refunded ones too); refunds counted separately; net = collected - refunds
    const dbRevenue = await db.payment.aggregate({ where: { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, registration: { event: { organizationId: ev.organizationId, deletedAt: null } } }, _sum: { amount: true, refundAmount: true } });
    const stats = op.json?.data?.stats || op.json?.stats || op.json?.data || {};
    const cents = (n) => Math.round(Number(n || 0) * 100);
    S.check('Org revenue collected = sum of paid payments in the DB (refunded included)', cents(stats.totalRevenue) === cents(dbRevenue._sum.amount), `api=${stats.totalRevenue} db=${dbRevenue._sum.amount}`);
    S.check('Org refunds = sum of refunded amounts in the DB', cents(stats.refunds) === cents(dbRevenue._sum.refundAmount), `api=${stats.refunds} db=${dbRevenue._sum.refundAmount}`);
    const regs = await L.api(orgP, 'GET', `/api/admin/org/${ev.organizationId}/registrations?eventId=${ev.id}&search=e2e-att-pay`);
    const rText = JSON.stringify(regs.json || {});
    S.check('Org registrations show pay1 confirmed and pay2 cancelled', regs.status === 200 && rText.includes('e2e-att-pay1') && rText.includes('CANCELLED'), `${regs.status}`);
    await L.go(orgP, '/admin/org/payments', { settle: 3000 });
    t = await L.bodyText(orgP);
    S.check('Organizer payments page shows the buyers', /E2E Payer|e2e-att-pay/i.test(t), '');
    await L.shot(orgP, 'pay-organizer-payments');

    // ------------------------------------------------------------ F. plan purchase can't be faked
    S.area('F. Plan upgrade cannot be activated without Razorpay');
    const sub = await L.api(orgP, 'POST', '/api/admin/billing/subscribe', { entityType: 'org', entityId: ev.organizationId, plan: 'PRO', billingInterval: 'MONTHLY' });
    S.check('Subscribe without a gateway -> refused (no free upgrade)', sub.status >= 400, `${sub.status} ${sub.json?.message}`);
    const fakeO = rid('order'), fakeP = rid('pay');
    const bv = await L.api(orgP, 'POST', '/api/admin/billing/verify', { razorpay_order_id: fakeO, razorpay_payment_id: fakeP, razorpay_signature: sigPay(fakeO, fakeP) });
    const planNow = await db.subscription.findFirst({ where: { organizationId: ev.organizationId }, select: { plan: true, status: true } });
    S.check('A correctly signed but invented plan order does not upgrade the plan', bv.status >= 400 && planNow?.plan !== 'PRO', `${bv.status} ${bv.json?.message} plan=${planNow?.plan}`);

    // ------------------------------------------------------------ G. emails
    S.area('G. Emails');
    const mail = await inbox();
    if (mail === null) S.note('Mail catcher not running', 'emails not checked');
    else {
      const mine = mail.slice(mail0 || 0).filter(m => m.to.some(x => x.startsWith('e2e-att-pay')));
      for (const m of mine) S.note('email', `${m.to.join(',')} :: ${m.subject}`);
      S.check('pay1 got an email at registration', mine.some(m => m.to.includes(USERS[0])), '');
      S.check('pay1 got a payment receipt / "confirmed" email after paying', mine.some(m => m.to.includes(USERS[0]) && /^Payment received/i.test(m.subject)), mine.filter(m => m.to.includes(USERS[0])).map(m => m.subject).join(' | '));
      S.check('pay2 told about the refund by email', mine.some(m => m.to.includes(USERS[1]) && /refund|cancel/i.test(m.subject)), mine.filter(m => m.to.includes(USERS[1])).map(m => m.subject).join(' | '));
    }
  } catch (e) {
    S.check('suite crashed', false, e.stack);
  } finally {
    await browser.close().catch(() => { });
    const log = await L.purgeUsers(USERS);
    await db.coupon.deleteMany({ where: { code: COUPON } });
    const after = await state(ev.id);
    S.check('Cleanup: event seat and stock counters back to where they started', after.cur === before.cur && after.sold[day.name] === before.sold[day.name] && after.sold[fest.name] === before.sold[fest.name], `cur ${before.cur}->${after.cur} sold ${JSON.stringify(before.sold)}->${JSON.stringify(after.sold)} | ${log.join('; ')}`);
    await db.$disconnect();
    process.exit(S.finish() ? 1 : 0);
  }
})();
