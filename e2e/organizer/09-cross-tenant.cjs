// Cross-tenant: bob (ORG_ADMIN Cultural Society) must not see or change anything of Tech Club's
// (API 403/404 and no UI leakage); a plain attendee must not reach organizer APIs either.
const L = require('./lib.cjs')

L.run('09-cross-tenant', async (T, browser) => {
  const S = L.state()
  const A = S.eventA
  if (!A) throw new Error('Run 01 first')
  const db = L.db()
  const { orgId, otherOrgId } = await L.orgIds()
  const bob = await L.session(browser, 'bob')
  const reg = await db.registration.findFirst({ where: { eventId: A.id } })
  const cert = await db.certificate.findFirst({ where: { eventId: A.id } })
  const ci = await db.checkIn.findFirst({ where: { eventId: A.id } })
  const aliceM = await db.organizationMember.findFirst({ where: { organizationId: orgId, user: { email: 'alice@test.local' } } })
  const before = await db.event.findUnique({ where: { id: A.id }, select: { title: true, status: true, updatedAt: true } })
  const denied = (r) => r.status === 403 || r.status === 404
  const T_ = `/api/admin/org/${orgId}`, C_ = `/api/admin/org/${otherOrgId}`

  const checks = [
    ['list Tech Club events', 'GET', `${T_}/events`],
    ['read event A via Tech Club', 'GET', `${T_}/events/${A.id}`],
    ['read event A via own org', 'GET', `${C_}/events/${A.id}`],
    ['edit event A via own org', 'PATCH', `${C_}/events/${A.id}`, { title: 'hacked' }],
    ['edit event A via Tech Club', 'PATCH', `${T_}/events/${A.id}`, { title: 'hacked' }],
    ['duplicate event A via own org', 'POST', `${C_}/events/${A.id}/duplicate`],
    ['cancel event A via own org', 'POST', `${C_}/events/${A.id}/cancel`, { reason: 'x' }],
    ['delete event A via own org', 'DELETE', `${C_}/events/${A.id}`],
    ['event A analytics via own org', 'GET', `${C_}/events/${A.id}/analytics`],
    ['Tech Club registrations', 'GET', `${T_}/registrations`],
    ['approve/cancel a Tech Club registration via own org', 'PATCH', `${C_}/registrations/${reg && reg.id}/status`, { status: 'CANCELLED' }],
    ['add participant to event A via own org', 'POST', `${C_}/registrations`, { eventId: A.id, name: 'Hacker', email: `${L.EMAIL_PREFIX}hacker-${S.runId}@test.local`, ticketTypeId: 'x' }],
    ['check-in stats of event A', 'GET', `/api/check-in/stats?eventId=${A.id}`],
    ['check-in search of event A', 'GET', `/api/check-in/search?eventId=${A.id}&search=e2e`],
    ['check-in export of event A', 'GET', `/api/check-in/export?eventId=${A.id}`],
    ['check someone in at event A', 'POST', '/api/check-in', { method: 'MANUAL', registrationId: reg && reg.id, eventId: A.id }],
    ...(ci ? [['undo a Tech Club check-in', 'POST', '/api/check-in/undo', { checkInId: ci.id }]] : []),
    ...(cert ? [['revoke a Tech Club certificate via own org', 'PATCH', `${C_}/certificates/${cert.id}`, { action: 'revoke' }], ['resend a Tech Club certificate via own org', 'POST', `${C_}/certificates/${cert.id}/resend`]] : []),
    ['generate certificates for event A via own org', 'POST', `${C_}/certificates/generate`, { eventId: A.id }],
    ['post an announcement on event A via own org', 'POST', `${C_}/announcements`, { eventId: A.id, title: 'x', content: 'x' }],
    ['Tech Club drafts', 'GET', `${T_}/communications`],
    ['Tech Club audit log', 'GET', `${T_}/audit-logs`],
    ['Tech Club settings', 'GET', `${T_}/settings`],
    ['Tech Club billing usage', 'GET', `${T_}/billing/usage`],
    ['invite into Tech Club', 'POST', '/api/members/invite', { email: `${L.EMAIL_PREFIX}bobinv-${S.runId}@test.local`, role: 'VIEWER', entityType: 'ORGANIZATION', entityId: orgId }],
    ["change alice's role", 'PATCH', `/api/members/${aliceM.id}/role`, { role: 'VIEWER', entityType: 'ORGANIZATION', entityId: orgId }],
    ["change alice's role claiming own org", 'PATCH', `/api/members/${aliceM.id}/role`, { role: 'VIEWER', entityType: 'ORGANIZATION', entityId: otherOrgId }],
    ['Tech Club website', 'GET', `${T_}/website`],
  ]
  await T.step('API refuses every Tech Club action', async () => {
    for (const [label, method, url, body] of checks) {
      const r = await L.api(bob, method, url, body)
      T.ok(`bob: ${label} -> ${r.status}`, denied(r), r.json || r.status)
    }
  })

  await T.step('own-org endpoints do not leak Tech Club rows', async () => {
    const regs = await L.api(bob, 'GET', `${C_}/registrations?eventId=${A.id}`)
    T.ok("registrations?eventId=<Tech Club event> under own org returns nothing", regs.status === 200 && regs.json.data.length === 0, regs.json && regs.json.data && regs.json.data.length)
    const exp = await L.api(bob, 'GET', `${C_}/registrations/export?eventId=${A.id}`)
    T.ok('export with a Tech Club eventId has only the header row', exp.status === 200 && (exp.text || '').replace(/^﻿/, '').split('\r\n').length === 1, (exp.text || '').slice(0, 200))
    const send = await L.api(bob, 'POST', `${C_}/communications/send`, { recipientFilter: { type: 'by_event', eventId: A.id }, subject: 'x', body: 'x' })
    T.ok('email to a Tech Club event from own org reaches nobody', send.status === 400 && /no participants/i.test(send.json.message), send.json)
    const evs = await L.api(bob, 'GET', `${C_}/events?search=E2E-ORG`)
    T.ok("own events list doesn't include Tech Club's E2E events", evs.status === 200 && evs.json.data.length === 0)
  })

  await T.step('nothing changed', async () => {
    const after = await db.event.findUnique({ where: { id: A.id }, select: { title: true, status: true, updatedAt: true } })
    T.ok('event A unchanged', after.title === before.title && after.status === before.status && after.updatedAt.getTime() === before.updatedAt.getTime())
    T.ok("alice still ORG_ADMIN", (await db.organizationMember.findUnique({ where: { id: aliceM.id } })).role === 'ORG_ADMIN')
    T.ok('no hacker account created', !(await db.user.findUnique({ where: { email: `${L.EMAIL_PREFIX}hacker-${S.runId}@test.local` } })))
  })

  await T.step('no UI leakage', async () => {
    await L.goto(bob, '/admin/org/events')
    await L.sleep(2000)
    let txt = await L.bodyText(bob)
    T.ok("bob's events page has no Tech Club events", !txt.includes('E2E-ORG') && !txt.includes('Rust for Systems'))
    T.ok('org switcher shows Cultural Society, not Tech Club', txt.includes('Cultural Society') && !txt.includes('Tech Club'))
    await L.goto(bob, `/admin/org/events/${A.id}`)
    await L.sleep(2000)
    txt = await L.bodyText(bob)
    T.ok("Tech Club event page by id shows nothing of it", !txt.includes(A.title.slice(0, 20)), txt.slice(0, 200))
    await L.goto(bob, `/admin/org/events/${A.id}/check-in`)
    await L.sleep(2500)
    txt = await L.bodyText(bob)
    T.ok('check-in page for a Tech Club event leaks no title or numbers', !txt.includes('E2E-ORG') && !/Expected\s*[1-9]/.test(txt), txt.slice(0, 300))
    await L.shot(bob, '09-bob-checkin-other-org')
    await L.goto(bob, `/admin/org/events/${A.id}/registrations`)
    await L.sleep(2500)
    txt = await L.bodyText(bob)
    T.ok('registrations page for a Tech Club event lists nobody', !txt.includes('e2e-org-') && !txt.includes('E2E Org Attendee'))
  })
  await L.closeSession(bob)

  await T.step('a plain attendee cannot use organizer APIs', async () => {
    const p = await L.session(browser, S.att1)
    for (const [label, method, url, body] of [['org events', 'GET', `${T_}/events`], ['registrations', 'GET', `${T_}/registrations`], ['check someone in', 'POST', '/api/check-in', { method: 'MANUAL', registrationId: reg && reg.id, eventId: A.id }], ['send email', 'POST', `${T_}/communications/send`, { recipientFilter: { type: 'all' }, subject: 'x', body: 'x' }]]) {
      const r = await L.api(p, method, url, body)
      T.ok(`attendee: ${label} -> ${r.status}`, denied(r), r.json)
    }
    const st = await L.goto(p, '/admin/org/events')
    T.ok('attendee is kept out of /admin', !p.url().includes('/admin/org/events') || st >= 400, p.url())
    await L.closeSession(p)
  })
})
