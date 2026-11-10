// Registrations on event A (approval required, free + paid tickets):
// attendee registers through the public form -> organizer list for THAT event + counters ->
// approve / reject (attendee side updates) -> Add participant (unknown email gets an account and a
// ticket) -> paid ticket shows "payments not configured" -> search and status filters -> CSV export
// (formula-safe, scoped to the event).
const L = require('./lib.cjs')

async function registerViaForm(T, browser, user, eventSlug, ticket, label) {
  const p = await L.session(browser, user)
  await L.goto(p, `/events/${eventSlug}/register`)
  await L.waitText(p, 'Choose your ticket', 20000)
  await L.clickText(p, ticket, 'label')
  await L.clickText(p, /^Continue$/)
  await p.waitForSelector('#reg-name', { timeout: 15000 })
  // try to continue with nothing filled in: required fields must be flagged
  await L.clickText(p, /^Continue$/)
  await L.sleep(500)
  const errs = await p.$$eval('[id$="-error"]', (e) => e.map((x) => x.innerText).filter(Boolean))
  T.ok(`${label}: required fields are flagged (T-shirt size, terms)`, errs.length >= 2, errs)
  await L.typeInto(p, '#reg-organization', 'E2E University')
  await L.typeInto(p, '#reg-department', 'Computer Science')
  const fieldId = (text) => p.evaluate((t) => [...document.querySelectorAll('label')].find((l) => l.innerText.trim().startsWith(t))?.getAttribute('for'), text)
  const tshirt = await fieldId('T-shirt size')
  await L.selectOption(p, `[id="${tshirt}"]`, 'Medium')
  const gh = await fieldId('GitHub handle')
  if (gh) await L.typeInto(p, `[id="${gh}"]`, 'e2e-org-dev')
  await p.click('label[for="terms"]')
  await L.clickText(p, /^Continue$/)
  const onReview = await L.waitText(p, ticket === 'Supporter' ? 'Pay ₹' : 'Confirm registration', 15000)
  T.ok(`${label}: details accepted, review step shown`, onReview)
  await L.clearToasts(p)
  await L.clickText(p, ticket === 'Supporter' ? /^Pay ₹/ : 'Confirm registration')
  return p
}

L.run('02-registrations', async (T, browser) => {
  const S = L.state()
  const A = S.eventA
  if (!A) throw new Error('Run 01-event-lifecycle first (no eventA in state)')
  const db = L.db()
  const { orgId } = await L.orgIds()
  const att1 = S.att1

  // ---------- attendee registers through the public form ----------
  await T.step('attendee registers (approval required)', async () => {
    const p = await registerViaForm(T, browser, att1, A.slug, 'Student Pass', 'att1')
    const done = await L.waitText(p, 'Registration', 20000)
    await L.sleep(1500)
    const txt = await L.bodyText(p)
    await L.shot(p, '02-att1-registered')
    T.ok('success screen tells the attendee it awaits approval', /approv|pending|review/i.test(txt), txt.slice(0, 500))
    const reg = await db.registration.findFirst({ where: { eventId: A.id, userId: att1.id } })
    T.ok('registration stored as PENDING', reg && reg.status === 'PENDING', reg && reg.status)
    T.ok('form answers stored (organization, department, T-shirt size)', reg && reg.formResponses && reg.formResponses.organization === 'E2E University' && reg.formResponses.department === 'Computer Science' && JSON.stringify(reg.formResponses).includes('Medium'), reg && reg.formResponses)
    T.ok('no phone answer stored (phone not asked)', reg && !('phone' in (reg.formResponses || {})))
    L.setState('reg1', reg && reg.id)
    // the attendee looks for it under My events while it waits for approval
    await L.goto(p, '/dashboard/events')
    await L.sleep(2500)
    const mine = await L.bodyText(p)
    const listed = mine.includes(A.title.slice(0, 24))
    T.ok('a registration awaiting approval is listed in My events (as pending)', listed, mine.slice(mine.indexOf('My events'), mine.indexOf('My events') + 200))
    if (!listed) T.uxIssue('major', '/dashboard/events (attendee, approval-required event)', 'My events is built only from tickets (/api/users/me/tickets), so a registration that is pending approval, unpaid, waitlisted or rejected does not appear at all: right after registering the attendee sees "0 events registered" and may register again or think it failed.', 'Build My events from registrations (with status pills: Pending approval / Awaiting payment / Waitlisted / Rejected) and attach the ticket when there is one.')
    await L.shot(p, '02-att1-my-events-pending')
    await L.closeSession(p)
  })

  // another attendee whose name starts with "-" (to check CSV formula escaping later)
  await T.step('second and third attendee register by API', async () => {
    const anon = await L.session(browser, null)
    const att3 = await L.createAttendee(anon, 'att3', '-E2E Minus Three')
    const att4 = await L.createAttendee(anon, 'att4', '+E2E Plus Four')
    L.setState('att3', att3); L.setState('att4', att4)
    await L.closeSession(anon)
    const student = await db.ticketType.findFirst({ where: { eventId: A.id, name: 'Student Pass' } })
    const p3 = await L.session(browser, att3)
    const r = await L.api(p3, 'POST', '/api/registrations', { eventId: A.id, ticketTypeId: student.id, quantity: 1, formResponses: { name: '-E2E Minus Three', organization: '@E2E Org', department: 'Maths', 'T-shirt size': 'Large' } })
    T.ok('att3 registration accepted (PENDING)', r.status === 201 && r.json.data.registration.status === 'PENDING', r.json)
    await L.closeSession(p3)
  })

  // ---------- organizer list for THIS event ----------
  const org = await L.session(browser, 'alice')
  await T.step('organizer sees the registrations of this event only', async () => {
    await L.goto(org, `/admin/org/events/${A.id}/registrations`)
    T.ok('att1 listed', await L.waitText(org, att1.email, 20000))
    const txt = await L.bodyText(org)
    T.ok('att3 listed', txt.includes(L.state().att3.email))
    T.ok("the cancelled copy's registration (att2) is NOT in this event's list", !txt.includes(S.att2.email))
    const kpi = await org.evaluate(() => document.body.innerText.match(/Total\s*(\d+)[\s\S]*?Pending\s*(\d+)/))
    T.ok('KPI strip: Total 2, Pending 2', kpi && kpi[1] === '2' && kpi[2] === '2', kpi && kpi.slice(1))
    await L.shot(org, '02-org-registrations-pending')
    const ev = await db.event.findUnique({ where: { id: A.id }, select: { currentRegistrations: true } })
    T.ok('pending (unapproved) registrations do not take a seat yet', ev.currentRegistrations === 0, ev.currentRegistrations)
  })

  await T.step('approve att1', async () => {
    await L.clearToasts(org)
    await org.click('button[aria-label="Approve E2E Org Attendee One"]')
    const toast = await L.waitToast(org)
    T.ok('approve toast', toast && /confirmed|approved/i.test(toast.text), toast)
    await L.sleep(800)
    const reg = await db.registration.findFirst({ where: { eventId: A.id, userId: att1.id }, include: { ticket: true } })
    T.ok('registration CONFIRMED with approvedBy', reg.status === 'CONFIRMED' && !!reg.approvedBy, reg.status)
    T.ok('a ticket is issued on approval', !!reg.ticket && reg.ticket.status === 'ACTIVE', reg.ticket)
    L.setState('ticket1', reg.ticket && reg.ticket.ticketNumber)
    const ev = await db.event.findUnique({ where: { id: A.id }, select: { currentRegistrations: true } })
    const tt = await db.ticketType.findFirst({ where: { eventId: A.id, name: 'Student Pass' } })
    const holding = await db.registration.count({ where: { ticketTypeId: tt.id, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'WAITLISTED'] } } })
    T.ok('event seat counter 1 after approval; ticket stock = registrations holding it', ev.currentRegistrations === 1 && tt.sold === holding, [ev.currentRegistrations, tt.sold, holding])
    const n = await db.notification.findFirst({ where: { userId: att1.id, title: 'Registration Approved' } })
    T.ok('attendee gets an "approved" notification', !!n)
    T.ok('audit log: registration approved', !!(await db.auditLog.findFirst({ where: { entityId: reg.id, description: { startsWith: 'CONFIRMED' } } })))
  })

  await T.step('reject att3 with a reason', async () => {
    const att3 = L.state().att3
    await org.click('button[aria-label="Reject -E2E Minus Three"]')
    await org.waitForSelector('#remove-registration-reason')
    await L.typeInto(org, '#remove-registration-reason', 'E2E: not a student')
    await L.clearToasts(org)
    await L.clickText(org, /^Reject$/, '[role="dialog"] button')
    const toast = await L.waitToast(org)
    T.ok('reject toast', toast && /reject/i.test(toast.text), toast)
    await L.sleep(800)
    const reg = await db.registration.findFirst({ where: { eventId: A.id, userId: att3.id } })
    T.ok('registration REJECTED with the reason', reg.status === 'REJECTED' && reg.rejectionReason === 'E2E: not a student', [reg.status, reg.rejectionReason])
    const n = await db.notification.findFirst({ where: { userId: att3.id, title: 'Registration Rejected' } })
    T.ok('attendee gets a "rejected" notification with the reason', n && n.message.includes('not a student'), n && n.message)
  })

  await T.step('attendee side reflects approval and rejection', async () => {
    const p1 = await L.session(browser, att1)
    await L.goto(p1, '/dashboard/tickets')
    const t1 = await L.waitText(p1, A.title.replace(/ edited$/, ''), 20000)
    T.ok("approved attendee sees the ticket in My tickets", t1)
    await L.shot(p1, '02-att1-tickets')
    await L.goto(p1, '/dashboard/notifications')
    T.ok('approved attendee sees "Registration Approved" in notifications', await L.waitText(p1, 'Registration Approved', 15000))
    await L.closeSession(p1)
    const p3 = await L.session(browser, L.state().att3)
    await L.goto(p3, '/dashboard/events')
    await L.sleep(2000)
    const txt = await L.bodyText(p3)
    T.ok('rejected attendee sees the registration as rejected in My events', /reject/i.test(txt), txt.slice(txt.indexOf('My events'), txt.indexOf('My events') + 200))
    if (!/reject/i.test(txt)) T.uxIssue('minor', '/dashboard/events (attendee, after an organizer rejects)', 'A rejected registration disappears from My events (All shows 0); the only trace is a notification, so the attendee cannot see the status or the reason where they look for their events.', 'List rejected/cancelled registrations under All (or a Past/Closed group) with the status and reason.')
    await L.shot(p3, '02-att3-events')
    await L.goto(p3, '/dashboard/notifications')
    T.ok('rejected attendee sees "Registration Rejected" with the reason', await L.waitText(p3, 'not a student', 15000))
    await L.closeSession(p3)
  })

  // ---------- Add participant (manual) ----------
  await T.step('add participant with an unknown email', async () => {
    const email = `${L.EMAIL_PREFIX}walkin-${S.runId}@test.local`
    L.track('users', email)
    await L.goto(org, `/admin/org/events/${A.id}/registrations`)
    await L.clickText(org, 'Add participant')
    await org.waitForSelector('#add-participant-name')
    await L.typeInto(org, '#add-participant-name', '=E2E Walkin')
    await L.typeInto(org, '#add-participant-email', email)
    await L.selectOption(org, '#add-participant-ticket', 'Student Pass')
    await L.clearToasts(org)
    await L.clickText(org, /^Add participant$/, '[role="dialog"] button')
    const toast = await L.waitToast(org)
    T.ok('add participant toast', toast && /registered/i.test(toast.text), toast)
    await L.sleep(800)
    const u = await db.user.findUnique({ where: { email }, include: { registrations: { where: { eventId: A.id }, include: { ticket: true } } } })
    T.ok('an account is created for the unknown email', !!u)
    const reg = u && u.registrations[0]
    T.ok("organizer's add counts as approval: CONFIRMED", reg && reg.status === 'CONFIRMED', reg && reg.status)
    T.ok('a ticket is issued', reg && reg.ticket && reg.ticket.status === 'ACTIVE')
    T.ok('source recorded as manual/admin', reg && reg.source && reg.source !== 'WEBSITE', reg && reg.source)
    L.setState('walkin', { email, id: u && u.id, name: '=E2E Walkin', ticket: reg && reg.ticket && reg.ticket.ticketNumber, regNo: reg && reg.registrationNumber })
    T.ok('list shows the new participant', await L.waitText(org, email, 15000))
    // the same email again is refused
    const again = await L.api(org, 'POST', `/api/admin/org/${orgId}/registrations`, { eventId: A.id, name: 'Dup', email, ticketTypeId: reg.ticketTypeId })
    T.ok('adding the same email twice is refused (409)', again.status === 409, again)
  })

  // ---------- paid ticket: payments not configured ----------
  await T.step('paid registration shows "payments not configured"', async () => {
    const p = await registerViaForm(T, browser, L.state().att4, A.slug, 'Supporter', 'att4 (paid)')
    // No keys: "Online payment isn't available". With the suite's stand-in keys Razorpay refuses the
    // order, and the buyer is told nothing was charged. Either way: a clear message, no charge.
    let msg = false
    for (let t = 0; t < 25 && !msg; t++) {
      const body = await L.bodyText(p)
      msg = /Online payment isn't available|couldn't start the payment just now\. Nothing was charged/i.test(body)
      if (!msg) await L.sleep(1000)
    }
    await L.shot(p, '02-att4-paid-unavailable')
    T.ok('paid checkout explains payment is unavailable and nothing was charged', msg, (await L.bodyText(p)).slice(0, 600))
    const reg = await db.registration.findFirst({ where: { eventId: A.id, userId: L.state().att4.id }, include: { payment: true } })
    T.ok('paid registration held as PENDING with a pending ₹199 payment', reg && reg.status === 'PENDING' && reg.payment && Number(reg.payment.amount) === 199 && reg.payment.status === 'PENDING', reg && [reg.status, reg.payment])
    await L.closeSession(p)
  })

  // ---------- search, filters ----------
  await T.step('search and status filters', async () => {
    await L.goto(org, `/admin/org/events/${A.id}/registrations`)
    await L.waitText(org, att1.email, 20000)
    await L.typeInto(org, 'input[aria-label="Search registrations"]', 'att1-')
    await L.sleep(1500)
    let txt = await L.bodyText(org)
    T.ok('search by email narrows to att1', txt.includes(att1.email) && !txt.includes(L.state().att4.email), txt.slice(0, 300))
    await L.typeInto(org, 'input[aria-label="Search registrations"]', L.state().walkin.regNo)
    await L.sleep(1500)
    txt = await L.bodyText(org)
    T.ok('search by registration # finds the walk-in', txt.includes(L.state().walkin.email) && !txt.includes(att1.email))
    await L.typeInto(org, 'input[aria-label="Search registrations"]', ' ')
    await org.$eval('input[aria-label="Search registrations"]', (e) => { e.value = '' })
    await L.setValue(org, 'input[aria-label="Search registrations"]', '')
    await L.selectOption(org, 'button[aria-label="Filter by status"]', 'Rejected')
    await L.sleep(1500)
    txt = await L.bodyText(org)
    T.ok('status filter Rejected shows only att3', txt.includes(L.state().att3.email) && !txt.includes(att1.email), txt.slice(0, 400))
    await L.selectOption(org, 'button[aria-label="Filter by status"]', 'Pending')
    await L.sleep(1500)
    txt = await L.bodyText(org)
    T.ok('status filter Pending shows the unpaid att4 only', txt.includes(L.state().att4.email) && !txt.includes(att1.email))
    const kpi = await org.evaluate(() => document.body.innerText.match(/Total\s*(\d+)[\s\S]*?Confirmed\s*(\d+)[\s\S]*?Pending\s*(\d+)/))
    const counts = await db.registration.groupBy({ by: ['status'], where: { eventId: A.id }, _count: true })
    const c = Object.fromEntries(counts.map((x) => [x.status, x._count]))
    const total = counts.reduce((n, x) => n + x._count, 0)
    T.ok('KPI strip matches the DB (total / confirmed / pending)', kpi && +kpi[1] === total && +kpi[2] === (c.CONFIRMED || 0) && +kpi[3] === (c.PENDING || 0), { kpi: kpi && kpi.slice(1), db: c })
  })

  await T.step('org-wide registrations page with eventId filter via API', async () => {
    const all = await L.api(org, 'GET', `/api/admin/org/${orgId}/registrations?eventId=${A.id}&limit=100`)
    T.ok('API eventId filter returns only this event', all.json.data.every((r) => r.eventId === A.id) && all.json.data.length === 4, all.json.data.map((r) => r.eventTitle))
  })

  // ---------- CSV export ----------
  await T.step('CSV export for this event', async () => {
    const r = await L.api(org, 'GET', `/api/admin/org/${orgId}/registrations/export?eventId=${A.id}`)
    T.ok('export returns a CSV attachment', r.status === 200 && /text\/csv/.test(r.headers.type) && /attachment/.test(r.headers.disposition || ''), r.headers)
    const csv = (r.text || '').replace(/^﻿/, '')
    require('fs').writeFileSync(require('path').join(L.OUT, 'downloads', 'registrations-eventA.csv'), csv)
    const lines = csv.split(/\r\n/)
    T.ok('CSV has a header + 4 rows (only this event)', lines.length === 5, lines.length)
    T.ok('"=" name is escaped', csv.includes(`"'=E2E Walkin"`), csv.split('\r\n').find((l) => l.includes('Walkin')))
    T.ok('"-" name is escaped', csv.includes(`"'-E2E Minus Three"`))
    T.ok('"+" name is escaped', csv.includes(`"'+E2E Plus Four"`))
    T.ok('no other event in the export', !csv.includes('(Copy)'))
    const hasAnswers = /E2E University|Computer Science|Medium/.test(csv)
    T.ok('export includes the answers the event asked for (organization, department, custom questions)', hasAnswers, lines[0])
    if (!hasAnswers) T.uxIssue('major', '/admin/org/events/[id]/registrations (Export CSV)', 'The CSV has only name/email/phone(account)/ticket/status. The answers the organizer asked for in the form (organization, department, T-shirt size, any custom question) are stored in formResponses but appear nowhere: not in the list, not in the export. The "Phone" column is the account phone, not the phone typed in the form.', 'Add one column per default field and custom form field (from formResponses) to registrations/export, and a registration detail drawer in the list.')
    const audit = await db.auditLog.findFirst({ where: { action: 'EXPORT', organizationId: orgId, createdAt: { gte: new Date(Date.now() - 120000) } } })
    T.ok('export is recorded in the audit log (EXPORT action)', !!audit, 'registrations/export writes no audit row although AuditAction has EXPORT: bulk PII downloads are not traceable')
  })

  // ---------- counters on the event page + events list ----------
  await T.step('event page counters match the DB', async () => {
    await L.goto(org, `/admin/org/events/${A.id}`)
    await L.waitText(org, 'Registrations', 15000)
    await L.sleep(1000)
    const txt = await L.bodyText(org)
    const ev = await db.event.findUnique({ where: { id: A.id }, select: { currentRegistrations: true, maxCapacity: true, _count: { select: { registrations: true } } } })
    const regCard = txt.match(/Registrations\s*(\d+)/)
    T.info(`event page: "${(regCard || [])[0]}", DB: ${ev._count.registrations} rows, ${ev.currentRegistrations} seats taken of ${ev.maxCapacity}`)
    T.ok('event page Registrations card equals the registrations in the DB', regCard && +regCard[1] === ev._count.registrations, { card: regCard && regCard[1], db: ev._count.registrations })
    if (regCard && +regCard[1] !== ev.currentRegistrations) T.uxIssue('minor', '/admin/org/events/[id]', `The "Registrations" card counts every registration row (${regCard[1]}, including rejected and unpaid ones) while the capacity bar and public "registered" count use seats taken (${ev.currentRegistrations}). Organizers see two different numbers for the same thing.`, 'Label the card "Registrations (all statuses)" or show confirmed + pending separately.')
    await L.shot(org, '02-event-detail')
  })
  await L.closeSession(org)
})
