// Door check-in on a phone (390x844) as a volunteer (COORDINATOR in Tech Club), event A moved to today.
// Expected / Checked in / Not arrived correct; ticket-number and registration-number lookup; manual
// check-in; repeat = "already checked in"; Undo reverts stats; QR path (decoded text sent to the
// API: the camera itself can't run headless); CSV export; attendee ticket shows checked in;
// analytics attendance; audit trail.
const fs = require('fs')
const path = require('path')
const L = require('./lib.cjs')

L.run('03-checkin', async (T, browser) => {
  const S = L.state()
  const A = S.eventA
  if (!A || !S.walkin) throw new Error('Run 01 and 02 first')
  const db = L.db()
  const { orgId } = await L.orgIds()
  const org = await L.session(browser, 'alice')

  // ---------- setup: event happening today; a volunteer on the team ----------
  await T.step('move event A to today and add a door volunteer', async () => {
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 60000), end = new Date(now.getTime() + 4 * 3600000)
    const r = await L.api(org, 'PATCH', `/api/admin/org/${orgId}/events/${A.id}`, { startDate: start.toISOString(), endDate: end.toISOString() })
    T.ok('organizer moves the event to today (PATCH)', r.status === 200, r.json)
    const anon = await L.session(browser, null)
    const vol = await L.createAttendee(anon, 'volunteer', 'E2E Door Volunteer')
    await L.closeSession(anon)
    const inv = await L.api(org, 'POST', '/api/members/invite', { email: vol.email, role: 'COORDINATOR', entityType: 'ORGANIZATION', entityId: orgId })
    T.ok('volunteer added to Tech Club as COORDINATOR', inv.status === 201 || (inv.status === 409 && /already a member/i.test(inv.json.message)), inv.json)
    // re-runnable: start from nobody checked in on this (test-owned) event
    const old = await db.checkIn.findMany({ where: { eventId: A.id } })
    for (const c of old) {
      await db.checkIn.delete({ where: { id: c.id } })
      await db.registration.update({ where: { id: c.registrationId }, data: { status: 'CONFIRMED' } })
      await db.ticket.update({ where: { id: c.ticketId }, data: { status: 'ACTIVE' } })
    }
    L.setState('volunteer', vol)
  })

  const vol = await L.session(browser, L.state().volunteer, L.PHONE)
  const expected = async () => db.registration.count({ where: { eventId: A.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } })
  const statsOnScreen = async (page) => page.evaluate(() => {
    const dl = document.querySelector('dl[aria-label="Check-in stats"]')
    if (!dl) return null
    // read each figure by its label (Expected, Checked in, Not arrived), not by position
    const num = (label) => {
      const dt = [...dl.querySelectorAll('dt')].find((x) => x.textContent.trim() === label)
      const dd = dt && dt.nextElementSibling
      return dd ? parseInt((dd.innerText.match(/^\s*([\d,]+)/) || [])[1]?.replace(/,/g, ''), 10) : NaN
    }
    return [num('Expected'), num('Checked in'), num('Not arrived')]
  })

  // ---------- volunteer finds the event ----------
  await T.step('volunteer reaches the event check-in on a phone', async () => {
    await L.goto(vol, '/admin/org/check-in')
    const listed = await L.waitText(vol, A.title, 20000)
    T.ok('check-in hub lists the event under today', listed)
    T.ok('hub has no horizontal scroll at 390px', (await L.overflowX(vol)) <= 1, await L.overflowX(vol))
    await L.shot(vol, '03-phone-hub')
    await vol.click(`a[href="/admin/org/events/${A.id}/check-in"]`)
    await vol.waitForSelector('dl[aria-label="Check-in stats"]', { timeout: 20000 })
    await L.sleep(1500)
    const st = await statsOnScreen(vol)
    const exp = await expected()
    T.ok(`stats: Expected ${exp}, Checked in 0, Not arrived ${exp}`, st && st[0] === exp && st[1] === 0 && st[2] === exp, { screen: st, expected: exp })
    T.ok('check-in page has no horizontal scroll at 390px', (await L.overflowX(vol)) <= 1, await L.overflowX(vol))
    const small = await L.smallTargets(vol, 32)
    if (small.length) T.uxIssue('minor', '/admin/org/events/[id]/check-in (phone)', `Touch targets under 32px on the door screen: ${[...new Set(small)].slice(0, 6).join(', ')}.`, 'Give every control on the check-in screen at least 44px height on touch (pointer-coarse:h-11).')
    await L.shot(vol, '03-phone-checkin-start')
    const csvBtn = await L.findByText(vol, 'button', 'CSV', { timeout: 2000 })
    const exp403 = await L.api(vol, 'GET', `/api/check-in/export?eventId=${A.id}`)
    if (csvBtn && exp403.status === 403) T.uxIssue('minor', '/admin/org/events/[id]/check-in (volunteer)', 'A Coordinator sees the "CSV" export button but the export answers 403 (needs REGISTRATION_EXPORT or CHECKIN_MANAGE); tapping it opens a JSON error page in a new tab.', 'Hide the CSV button with a PermissionGate for those permissions.')
    T.info(`volunteer CSV export status: ${exp403.status}`)
  })

  // ---------- manual lookup ----------
  const att1 = S.att1
  const reg1 = await db.registration.findFirst({ where: { eventId: A.id, userId: att1.id }, include: { ticket: true } })
  await T.step('manual lookup by ticket number (what the attendee shows)', async () => {
    await L.clickText(vol, 'Manual', 'button')
    await vol.waitForSelector('input[aria-label="Search participants"]')
    await L.typeInto(vol, 'input[aria-label="Search participants"]', reg1.ticket.ticketNumber)
    await L.sleep(1800)
    const txt = await L.bodyText(vol)
    const found = txt.includes(att1.email)
    T.ok(`ticket number ${reg1.ticket.ticketNumber} finds the attendee`, found, txt.includes('No participants found') ? 'No participants found' : txt.slice(0, 200))
    if (!found) T.uxIssue('major', '/admin/org/events/[id]/check-in (Manual)', `The attendee's ticket shows the ticket number (${reg1.ticket.ticketNumber}) in large type under the QR, but Manual search only matches name, email and registration # (EVT-...). A volunteer typing the ticket number gets "No participants found".`, 'Also match ticket.ticketNumber (and the QR code string) in /api/check-in/search; say "name, email, ticket or registration number" in the placeholder.')
    await L.shot(vol, '03-phone-search-ticketno')
  })

  await T.step('manual check-in by registration number', async () => {
    await L.typeInto(vol, 'input[aria-label="Search participants"]', reg1.registrationNumber)
    T.ok('registration number finds the attendee', await L.waitText(vol, att1.email, 10000))
    await L.clearToasts(vol)
    await L.clickText(vol, /^Check in$/, 'li button')
    const toast = await L.waitToast(vol)
    T.ok('"<name> checked in" toast', toast && /checked in/i.test(toast.text), toast)
    T.ok('row flips to checked in with Undo', !!(await vol.waitForSelector(`button[aria-label="Undo check-in for ${'E2E Org Attendee One'}"]`, { timeout: 8000 }).catch(() => null)))
    await L.sleep(1500)
    const st = await statsOnScreen(vol)
    const exp = await expected()
    T.ok(`stats update right away: Checked in 1, Not arrived ${exp - 1}`, st && st[1] === 1 && st[2] === exp - 1, { screen: st, expected: exp })
    const r = await db.registration.findUnique({ where: { id: reg1.id }, include: { ticket: true, checkIn: true } })
    T.ok('DB: registration CHECKED_IN, ticket USED, check-in row by the volunteer', r.status === 'CHECKED_IN' && r.ticket.status === 'USED' && r.checkIn && r.checkIn.checkedInBy === L.state().volunteer.id, [r.status, r.ticket.status, !!r.checkIn])
    await L.shot(vol, '03-phone-checked-in')
  })

  await T.step('repeat scan says already checked in', async () => {
    const again = await L.api(vol, 'POST', '/api/check-in', { method: 'MANUAL', registrationId: reg1.id, eventId: A.id })
    T.ok('manual repeat -> 409 ALREADY_CHECKED_IN', again.status === 409 && again.json.reason === 'ALREADY_CHECKED_IN', again.json)
    T.info(`repeat message: "${again.json && again.json.message}" (checked in by ${again.json && again.json.checkedInBy})`)
    if (reg1.ticket.qrCode.startsWith('{')) {
      const qr = await L.api(vol, 'POST', '/api/check-in', { method: 'QR_SCAN', qrData: reg1.ticket.qrCode, eventId: A.id })
      T.ok('QR repeat of the same ticket -> already checked in / already used', qr.status === 409 || (qr.json && /ALREADY/.test(qr.json.reason || '')), qr.json)
    } else T.info('QR repeat not testable: the free ticket QR is not a signed payload (see the QR step)')
  })

  await T.step('Undo reverts the check-in and the stats', async () => {
    await L.clearToasts(vol)
    await vol.click('button[aria-label="Undo check-in for E2E Org Attendee One"]')
    // Undo asks first ("Undo check-in for <name>?") so a stray tap can't reverse an arrival
    T.ok('Undo asks for confirmation', !!(await vol.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => null)))
    await L.sleep(700) // on a phone the dialog slides up as a sheet: click once it has settled
    // Click the confirm button itself (a mouse click at coordinates can land on the sheet while it
    // is still moving) and wait for the server's answer before reading the screen.
    const undoResp = vol.waitForResponse((q) => q.url().endsWith('/api/check-in/undo') && q.request().method() === 'POST', { timeout: 15000 }).catch(() => null)
    const confirmed = await vol.evaluate(() => {
      const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /^Undo check-in$/.test((b.innerText || '').trim()) && !b.disabled)
      if (btn) btn.click()
      return !!btn
    })
    T.ok('confirm button found in the dialog', confirmed)
    const resp = await undoResp
    T.ok('undo request succeeded', !!resp && resp.status() === 200, resp && resp.status())
    const toast = await L.waitToast(vol)
    T.ok('"Check-in reversed" toast', toast && /revers/i.test(toast.text), toast)
    await L.sleep(1500)
    const st = await statsOnScreen(vol)
    const exp = await expected()
    T.ok('stats revert: Checked in 0', st && st[1] === 0 && st[2] === exp, st)
    const r = await db.registration.findUnique({ where: { id: reg1.id }, include: { ticket: true, checkIn: true } })
    T.ok('DB: back to CONFIRMED, ticket ACTIVE, no check-in row', r.status === 'CONFIRMED' && r.ticket.status === 'ACTIVE' && !r.checkIn, [r.status, r.ticket.status])
    // the undo is logged against the check-in it reverses (that row is gone now); the registration is in oldValues
    const undoAudit = await db.auditLog.findFirst({ where: { entityType: 'CHECK_IN', description: { startsWith: 'Undid check-in' }, oldValues: { path: ['registrationId'], equals: reg1.id } }, orderBy: { createdAt: 'desc' } })
    T.ok('undo is in the audit trail', !!undoAudit)
    T.ok("undo audit row is visible in the organization's audit log (has organizationId)", !!(undoAudit && undoAudit.organizationId), undoAudit)
  })

  await T.step('late arrival: an active ticket of an ongoing event is easy to find', async () => {
    const p = await L.session(browser, att1, L.PHONE)
    await L.goto(p, '/dashboard/tickets')
    await p.waitForFunction(() => /All \(([1-9]\d*)\)/.test(document.body.innerText), { timeout: 20000 }).catch(() => {})
    await L.sleep(800)
    const txt = await L.bodyText(p)
    const up = +(txt.match(/Upcoming \((\d+)\)/) || [])[1], past = +(txt.match(/Past \((\d+)\)/) || [])[1], all = +(txt.match(/All \((\d+)\)/) || [])[1]
    T.ok('the ongoing event ticket (not yet scanned) is on the default Upcoming tab', up >= 1, { upcoming: up, past, all })
    if (!(up >= 1)) T.uxIssue('major', '/dashboard/tickets (attendee at the door)', `Once an event has started, its unused ticket is in neither Upcoming (needs startDate >= now) nor Past (needs USED or ended): the default tab says "No upcoming tickets" (Upcoming ${up}, Past ${past}, All ${all}). A late attendee at the door can't find their QR without guessing the All tab.`, 'Treat ACTIVE tickets whose event has not ended as upcoming (endDate >= now) in src/app/dashboard/tickets/page.tsx.')
    await L.shot(p, '03-attendee-tickets-ongoing')
    await L.closeSession(p)
  })

  // ---------- QR path (decoded text; camera can't run headless) ----------
  await T.step('QR scan of the attendee ticket (decoded text sent like the scanner does)', async () => {
    const t = await db.ticket.findUnique({ where: { id: reg1.ticket.id } })
    T.info(`attendee QR content: ${t.qrCode.slice(0, 60)}`)
    const r = await L.api(vol, 'POST', '/api/check-in', { method: 'QR_SCAN', qrData: t.qrCode, eventId: A.id })
    T.ok('scanning a free ticket QR checks the attendee in', r.status === 200 && r.json.success, r.json)
    if (!(r.status === 200 && r.json.success)) {
      T.uxIssue('blocker', '/admin/org/events/[id]/check-in (QR scanner) + /dashboard/tickets', `Free tickets (issued on free registration, on approval, and by Add participant) get qrCode "EVF-xxxx" from issueFreeTicket (src/lib/registration-ticket.ts), but the scanner's validateTicketQR (src/lib/ticket.ts) only accepts the signed JSON payload: scanning the QR on the attendee's ticket answers "${r.json && r.json.message}". Every free-ticket attendee has to be found by hand at the door.`, 'Issue free tickets with createQRPayload(ticketNumber, eventId, registrationNumber) like paid ones (and migrate existing EVF- codes), or let validateTicketQR look up a plain ticket.qrCode.')
      // fall back to a manual check-in so the rest of the flow (certificates, analytics) has an attendee
      const m = await L.api(vol, 'POST', '/api/check-in', { method: 'MANUAL', registrationId: reg1.id, eventId: A.id })
      T.ok('fallback: manual check-in works', m.status === 200, m.json)
    }
  })

  await T.step('check in the walk-in by name', async () => {
    await L.goto(vol, `/admin/org/events/${A.id}/check-in`)
    await L.clickText(vol, 'Attendees', '[role="tab"]')
    await vol.waitForSelector('input[aria-label="Search participants"]')
    const inputs = await vol.$$('input[aria-label="Search participants"]')
    let input = null
    for (const i of inputs) if (await i.evaluate((e) => e.getBoundingClientRect().width > 0)) input = i
    await input.type('Walkin')
    T.ok('name search finds the walk-in', await L.waitText(vol, S.walkin.email, 10000))
    await L.clearToasts(vol)
    await L.clickText(vol, /^Check in$/, 'li button')
    const toast = await L.waitToast(vol)
    T.ok('walk-in checked in', toast && /checked in/i.test(toast.text), toast)
    await L.sleep(1500)
    const st = await statsOnScreen(vol)
    const exp = await expected()
    T.ok(`stats: ${exp} expected, 2 checked in, ${exp - 2} not arrived`, st && st[0] === exp && st[1] === 2 && st[2] === exp - 2, st)
    await L.clickText(vol, 'Activity', '[role="tab"]')
    T.ok('Activity tab lists the latest arrivals', await L.waitText(vol, 'Latest arrivals', 8000) && (await L.bodyText(vol)).includes('E2E Org Attendee One'))
    await L.shot(vol, '03-phone-activity')
  })

  await T.step('wrong-event and cross-tenant check-ins are refused', async () => {
    const dupReg = await db.registration.findFirst({ where: { eventId: S.eventDup.id } })
    if (dupReg) {
      const r = await L.api(vol, 'POST', '/api/check-in', { method: 'MANUAL', registrationId: dupReg.id, eventId: A.id })
      T.ok("another event's registration is refused (404)", r.status === 404, r.json)
    }
    const other = await db.registration.findFirst({ where: { event: { organization: { slug: 'cultural-society' } }, status: 'CONFIRMED' } })
    if (other) {
      const r = await L.api(vol, 'POST', '/api/check-in', { method: 'MANUAL', registrationId: other.id, eventId: other.eventId })
      T.ok("Cultural Society's registration cannot be checked in by a Tech Club volunteer (403)", r.status === 403, r.json)
      const s = await L.api(vol, 'GET', `/api/check-in/stats?eventId=${other.eventId}`)
      T.ok("nor its stats read (403)", s.status === 403, s.status)
    }
  })

  // ---------- organizer export, attendee, analytics, audit ----------
  await T.step('organizer CSV export of attendance', async () => {
    const r = await L.api(org, 'GET', `/api/check-in/export?eventId=${A.id}`)
    const csv = (r.text || '').replace(/^﻿/, '')
    fs.writeFileSync(path.join(L.OUT, 'downloads', 'attendance-eventA.csv'), csv)
    T.ok('attendance CSV downloads (200, text/csv)', r.status === 200 && /csv/.test(r.headers.type || ''), r.status)
    const rows = csv.split('\r\n')
    T.ok('CSV lists the expected attendees with check-in time and who checked them in', rows.length - 1 === await expected() && rows.some((l) => l.includes('E2E Org Attendee One') && l.includes('E2E Door Volunteer')), rows.slice(0, 4))
    T.ok('CSV escapes the "=E2E Walkin" name', csv.includes(`"'=E2E Walkin"`))
  })

  await T.step("attendee's ticket shows checked in", async () => {
    const p = await L.session(browser, att1, L.PHONE)
    await L.goto(p, '/dashboard/tickets')
    await L.waitText(p, 'Past (', 15000)
    await L.clickText(p, /^Past/, '[role="tab"]')
    await L.waitText(p, 'E2E-ORG', 15000)
    await L.sleep(1000)
    const txt = await L.bodyText(p)
    T.ok("attendee's My tickets shows the ticket as used / checked in", /checked in|used|attended/i.test(txt), txt.slice(txt.indexOf('E2E-ORG') - 100, txt.indexOf('E2E-ORG') + 300))
    await L.shot(p, '03-attendee-ticket-after-checkin')
    await L.closeSession(p)
  })

  await T.step('analytics attendance reflects the check-ins', async () => {
    const a = await L.api(org, 'GET', `/api/admin/org/${orgId}/events/${A.id}/analytics`)
    const ov = a.json && a.json.data && a.json.data.overview
    const exp = await expected()
    T.ok('event analytics: 2 check-ins', ov && ov.checkIns === 2, ov)
    T.ok(`event analytics attendance rate = 2/${exp}`, ov && ov.attendanceRate === Math.round((2 / exp) * 100), ov && ov.attendanceRate)
    await L.goto(org, `/admin/org/events/${A.id}`)
    await L.waitText(org, 'Check-ins', 15000)
    await L.sleep(800)
    const txt = await L.bodyText(org)
    const m = txt.match(/Check-ins\s*(\d+)\s*(\d+)% attendance/)
    T.ok('event page Check-ins card shows 2 and the attendance %', m && m[1] === '2', m && m.slice(1))
    const audit = await db.auditLog.findFirst({ where: { action: 'CHECK_IN', OR: [{ entityId: reg1.id }, { eventId: A.id }] } })
    T.ok('check-ins are written to the audit log (CHECK_IN action exists)', !!audit, 'POST /api/check-in writes no audit row')
  })

  await L.closeSession(vol)
  await L.closeSession(org)
})
