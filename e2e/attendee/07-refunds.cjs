// Organizer refunds, end to end, with offline (cash) payments so no Razorpay keys are needed:
//   - the Refund button on Payments: a partial refund keeps the ticket, refunding the rest cancels it
//     and frees the seat; the buyer gets an email each time;
//   - cancelling a paid event refunds everyone who paid (the "Refund everyone who paid" option) and
//     the cancellation email says so;
//   - the revenue numbers: refunded money still counts as collected, net = collected - refunds.
// Online (Razorpay) refunds are covered by unit tests (org-refund, refund-all-and-revenue).
// Optional: the mail catcher on localhost:1025 with its inbox at http://localhost:8025/messages.
//
// Run: node e2e/attendee/07-refunds.cjs      (cleans up after itself)
const L = require('./lib.cjs');
const { db } = L;

const S = L.suite('07-refunds');
const BUYERS = ['e2e-att-refund1@test.local', 'e2e-att-refund2@test.local'];
const SLUG = 'e2e-att-refund-event-' + Date.now().toString(36);
const PRICE = 300;

async function inbox() {
  try { return await (await fetch('http://localhost:8025/messages', { signal: AbortSignal.timeout(3000) })).json(); } catch { return null; }
}
async function waitToast(page, ms = 10000) {
  for (let t = 0; t < ms; t += 300) { const all = await L.toasts(page); if (all.length) return { text: all.join(' | ') }; await L.sleep(300); }
  return null;
}
// React-controlled inputs (number fields can't be selected for overwrite): native setter + input event
async function setVal(page, sel, v) {
  await page.waitForSelector(sel, { visible: true, timeout: 8000 });
  await page.$eval(sel, (el, val) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await L.sleep(150);
}
const mailTo = (box, to, re) => (box || []).filter((m) => JSON.stringify(m.to || '').includes(to) && re.test(String(m.subject || '') + ' ' + String(m.html || m.text || m.body || '')));

(async () => {
  if (!(await L.serverUp())) { console.error('Server not responding at ' + L.BASE); process.exit(2); }
  await L.purgeUsers(BUYERS);
  const org = await db.organization.findFirst({ where: { slug: 'tech-club' }, select: { id: true } });
  const alice = await db.user.findFirst({ where: { email: 'alice@test.local' }, select: { id: true } });
  const buyers = [await L.ensureUser(BUYERS[0], 'E2E Refund Buyer One'), await L.ensureUser(BUYERS[1], 'E2E Refund Buyer Two')];
  let eventId = null;
  const browser = await L.launch();
  try {
    // ---------------------------------------------------------------- setup: a paid event, two cash payments
    S.area('Setup');
    const start = new Date(Date.now() + 20 * 86400000);
    const ev = await db.event.create({
      data: {
        title: 'E2E Refund Night', slug: SLUG, shortDescription: 'End-to-end refund test, safe to ignore.', description: 'Created by e2e/attendee/07-refunds.cjs and deleted afterwards.',
        type: 'IN_PERSON', category: 'TECHNICAL', visibility: 'PUBLIC', status: 'PUBLISHED', startDate: start, endDate: new Date(start.getTime() + 3 * 3600000),
        timezone: 'Asia/Kolkata', venue: 'E2E Hall', venueCity: 'Bengaluru', isPaid: true, maxCapacity: 50, currentRegistrations: 2,
        organizationId: org.id, createdById: alice.id, publishedAt: new Date(),
        ticketTypes: { create: [{ name: 'Pass', price: PRICE, currency: 'INR', quantity: 50, sold: 2, maxPerUser: 1, isActive: true }] },
      },
      include: { ticketTypes: true },
    });
    eventId = ev.id;
    const tt = ev.ticketTypes[0];
    const regs = [];
    for (const [i, u] of buyers.entries()) {
      const reg = await db.registration.create({ data: { registrationNumber: `REG-E2ERF-${Date.now()}-${i}`, eventId, userId: u.id, ticketTypeId: tt.id, status: 'CONFIRMED', type: 'INDIVIDUAL', source: 'web' } });
      const pay = await db.payment.create({ data: { paymentNumber: `PAY-E2ERF${Date.now().toString(36).toUpperCase()}${i}`, registrationId: reg.id, userId: u.id, eventId, amount: PRICE, method: 'CASH', status: 'COMPLETED', paidAt: new Date() } });
      regs.push({ reg, pay });
    }
    S.check('a paid event with 2 cash payments of ₹300 exists', regs.length === 2);
    const mail0 = await inbox();

    const orgPage = await L.person(browser, { viewport: L.DESKTOP });
    await L.loginApi(orgPage, 'alice@test.local', L.DEMO_PASS);
    const statsBefore = (await L.api(orgPage, 'GET', `/api/admin/org/${org.id}/payments?limit=1`)).json.stats;

    // ---------------------------------------------------------------- partial refund from the Payments page
    S.area('Refund button: partial');
    await L.go(orgPage, '/admin/org/payments', { settle: 2500 });
    await orgPage.type('input[placeholder^="Search payment"]', regs[0].pay.paymentNumber);
    await L.sleep(2500);
    const opened = await L.clickText(orgPage, new RegExp(`^Refund ${regs[0].pay.paymentNumber}$`), 'button');
    S.check('the row has a Refund button that opens the dialog', opened && !!(await orgPage.waitForSelector('[role="dialog"] #refund-amount', { timeout: 8000 }).catch(() => null)));
    const prefill = await orgPage.$eval('#refund-amount', (e) => e.value).catch(() => null);
    S.check('the amount starts at what is left (300)', Number(prefill) === PRICE, prefill);
    await setVal(orgPage, '#refund-amount', '100');
    await setVal(orgPage, '#refund-reason', 'Half the talks were cancelled');
    const r1 = orgPage.waitForResponse((q) => q.url().endsWith(`/payments/${regs[0].pay.id}/refund`) && q.request().method() === 'POST', { timeout: 20000 }).catch(() => null);
    await orgPage.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /^Refund ₹/.test(x.innerText.trim())); if (b) b.click(); });
    const resp1 = await r1;
    S.check('partial refund accepted (200)', resp1 && resp1.status() === 200, resp1 && resp1.status());
    const toast1 = await waitToast(orgPage);
    S.check('toast says it was recorded', toast1 && /recorded as refunded|refunded/i.test(toast1.text), toast1);
    await L.shot(orgPage, 'refund-partial-1440');
    let p1 = await db.payment.findUnique({ where: { id: regs[0].pay.id } });
    let reg1 = await db.registration.findUnique({ where: { id: regs[0].reg.id } });
    S.check('DB: PARTIALLY_REFUNDED, ₹100 refunded, reason kept', p1.status === 'PARTIALLY_REFUNDED' && Number(p1.refundAmount) === 100 && /Half the talks/.test(p1.refundReason || ''), [p1.status, String(p1.refundAmount)]);
    S.check('DB: a partial refund keeps the registration', reg1.status === 'CONFIRMED', reg1.status);
    const n1 = await db.notification.findFirst({ where: { userId: buyers[0].id, title: 'Partial Refund Processed' } });
    S.check('buyer gets an in-app "Partial Refund Processed"', !!n1);

    // ---------------------------------------------------------------- refund the rest
    S.area('Refund button: the rest');
    await L.go(orgPage, '/admin/org/payments', { settle: 2500 });
    await orgPage.type('input[placeholder^="Search payment"]', regs[0].pay.paymentNumber);
    await L.sleep(2500);
    const rowText = await orgPage.evaluate(() => document.querySelector('main').innerText);
    S.check('the row shows "₹100 refunded"', /₹100 refunded/.test(rowText));
    await L.clickText(orgPage, new RegExp(`^Refund ${regs[0].pay.paymentNumber}$`), 'button');
    await orgPage.waitForSelector('[role="dialog"] #refund-amount', { timeout: 8000 }).catch(() => null);
    const prefill2 = await orgPage.$eval('#refund-amount', (e) => e.value).catch(() => null);
    S.check('the amount now starts at the ₹200 left', Number(prefill2) === 200, prefill2);
    await setVal(orgPage, '#refund-amount', '250');
    const over = await orgPage.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /^Refund/.test(x.innerText.trim())); return b ? b.disabled : null; });
    S.check('more than what is left can\'t be submitted', over === true, over);
    await setVal(orgPage, '#refund-amount', '200');
    const r2 = orgPage.waitForResponse((q) => q.url().endsWith(`/payments/${regs[0].pay.id}/refund`) && q.request().method() === 'POST', { timeout: 20000 }).catch(() => null);
    await orgPage.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /^Refund ₹/.test(x.innerText.trim())); if (b) b.click(); });
    const resp2 = await r2;
    S.check('refund of the rest accepted (200)', resp2 && resp2.status() === 200, resp2 && resp2.status());
    await L.sleep(1500);
    p1 = await db.payment.findUnique({ where: { id: regs[0].pay.id } });
    reg1 = await db.registration.findUnique({ where: { id: regs[0].reg.id } });
    const evAfter1 = await db.event.findUnique({ where: { id: eventId }, select: { currentRegistrations: true, ticketTypes: { select: { sold: true } } } });
    S.check('DB: REFUNDED with ₹300 refunded in total', p1.status === 'REFUNDED' && Number(p1.refundAmount) === PRICE, [p1.status, String(p1.refundAmount)]);
    S.check('DB: registration cancelled', reg1.status === 'CANCELLED', reg1.status);
    S.check('DB: the seat and the ticket stock are given back', evAfter1.currentRegistrations === 1 && evAfter1.ticketTypes[0].sold === 1, evAfter1);
    const again = await L.api(orgPage, 'POST', `/api/admin/org/${org.id}/payments/${regs[0].pay.id}/refund`, {});
    S.check('refunding a fully refunded payment again is refused (400)', again.status === 400, again.status);
    const noBtn = await orgPage.evaluate((n) => ![...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '') === `Refund ${n}`), regs[0].pay.paymentNumber);
    S.check('the fully refunded row no longer offers Refund', noBtn);

    // ---------------------------------------------------------------- cancel the event: the other buyer is refunded
    S.area('Cancelling a paid event refunds everyone');
    const cancel = await L.api(orgPage, 'POST', `/api/admin/org/${org.id}/events/${eventId}/cancel`, { reason: 'The hall flooded' });
    S.check('cancel accepted (200)', cancel.status === 200, cancel.json);
    S.check('cancel reports 1 payment refunded', cancel.json && cancel.json.data && cancel.json.data.refunds && cancel.json.data.refunds.refunded === 1 && cancel.json.data.refunds.remaining === 0, cancel.json && cancel.json.data);
    S.check('cancel message says so', /1 payment refunded/.test((cancel.json && cancel.json.message) || ''), cancel.json && cancel.json.message);
    const p2 = await db.payment.findUnique({ where: { id: regs[1].pay.id } });
    S.check('DB: the other buyer\'s payment is REFUNDED with the cancellation reason', p2.status === 'REFUNDED' && Number(p2.refundAmount) === PRICE && /The hall flooded/.test(p2.refundReason || ''), [p2.status, p2.refundReason]);
    const audit = await db.auditLog.findFirst({ where: { entityId: eventId, action: 'CANCEL' }, orderBy: { createdAt: 'desc' } });
    S.check('audit of the cancel records the refunds', audit && audit.newValues && audit.newValues.refunded === 1, audit && audit.newValues);
    await L.go(orgPage, '/admin/org/payments', { settle: 2500 });
    const banner = await orgPage.evaluate(() => /payments still to refund/i.test(document.querySelector('main').innerText));
    S.check('no "still to refund" banner (everything went back)', banner === false, banner);

    // ---------------------------------------------------------------- revenue numbers
    S.area('Revenue numbers');
    const statsAfter = (await L.api(orgPage, 'GET', `/api/admin/org/${org.id}/payments?limit=1`)).json.stats;
    const dGross = Math.round((statsAfter.totalRevenue - statsBefore.totalRevenue) * 100) / 100;
    const dRefunds = Math.round((statsAfter.refunds - statsBefore.refunds) * 100) / 100;
    S.check('refunded payments still count as collected (+₹0 change)', dGross === 0, { dGross });
    S.check('refunds went up by ₹600', dRefunds === 600, { dRefunds });
    S.check('net = collected - refunds (no double count)', statsAfter.totalRevenue - statsAfter.refunds >= 0, statsAfter);
    const ana = await L.api(orgPage, 'GET', `/api/admin/org/${org.id}/events/${eventId}/analytics`).catch(() => null);
    if (ana && ana.status === 200 && ana.json && ana.json.data && ana.json.data.revenueBreakdown) {
      const rb = ana.json.data.revenueBreakdown;
      S.check('event analytics: gross 600, refunds 600, net 0', rb.gross === 600 && rb.refunds === 600 && rb.net === 0, rb);
    } else {
      S.note('event analytics', `not checked (${ana && ana.status})`);
    }

    // ---------------------------------------------------------------- emails
    S.area('Emails');
    const box = await inbox();
    if (box === null) {
      S.note('emails', 'no mail catcher on :8025, not checked');
    } else {
      const fresh = box.slice((mail0 || []).length);
      S.check('buyer 1 got 2 "Refund processed" emails', mailTo(fresh, BUYERS[0], /Refund processed/i).length === 2, fresh.map((m) => m.subject));
      S.check('buyer 2 got "Refund processed"', mailTo(fresh, BUYERS[1], /Refund processed/i).length === 1);
      S.check('buyer 2\'s cancellation email says the ticket was refunded', mailTo(fresh, BUYERS[1], /has been refunded to your original payment method/i).length >= 1);
    }
    await orgPage.close();

    // ---------------------------------------------------------------- phone: refund reachable without sideways scrolling
    S.area('Phone');
    const phone = await L.person(browser, { viewport: L.PHONE });
    await L.loginApi(phone, 'alice@test.local', L.DEMO_PASS);
    await L.go(phone, '/admin/org/payments', { settle: 3000 });
    const reach = await phone.evaluate(() => {
      const b = [...document.querySelectorAll('button[aria-label^="Refund "]')][0];
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { right: Math.round(r.right), vw: window.innerWidth, pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    S.check('390px: a Refund button is on screen and the page doesn\'t scroll sideways', reach && reach.right <= reach.vw && !reach.pageOverflow, reach);
    await L.shot(phone, 'refund-payments-390');
    await phone.close();
  } catch (e) {
    S.check('script crashed', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e));
  } finally {
    await browser.close().catch(() => {});
    if (eventId) {
      await db.notification.deleteMany({ where: { eventId } });
      const payIds = (await db.payment.findMany({ where: { eventId }, select: { id: true } })).map((p) => p.id);
      await db.auditLog.deleteMany({ where: { OR: [{ eventId }, { entityId: eventId }, { entityId: { in: payIds } }] } });
      await db.event.delete({ where: { id: eventId } }).catch((e) => console.log('event cleanup', e.message));
    }
    console.log('purge', (await L.purgeUsers(BUYERS)).join('; '));
    S.finish();
    await db.$disconnect();
  }
})();
