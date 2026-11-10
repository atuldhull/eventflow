// Overview, analytics, billing usage and audit log: the numbers on screen and in the APIs
// match the DB after the earlier scripts' actions, and the audit log lists those actions.
const L = require('./lib.cjs')

L.run('07-overview-analytics-audit', async (T, browser) => {
  const S = L.state()
  const db = L.db()
  const { orgId, enterpriseId } = await L.orgIds()
  const org = await L.session(browser, 'alice')
  const evWhere = { organizationId: orgId, deletedAt: null }

  await T.step('overview API matches the DB', async () => {
    const r = await L.api(org, 'GET', `/api/admin/org/${orgId}/overview`)
    const d = r.json && r.json.data
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const [total, active, draft, regs, regsMonth, team] = await Promise.all([
      db.event.count({ where: evWhere }),
      db.event.count({ where: { ...evWhere, status: { in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING'] } } }),
      db.event.count({ where: { ...evWhere, status: 'DRAFT' } }),
      db.registration.count({ where: { event: evWhere, status: { notIn: ['CANCELLED', 'REJECTED'] } } }),
      db.registration.count({ where: { event: evWhere, status: { notIn: ['CANCELLED', 'REJECTED'] }, createdAt: { gte: monthStart } } }),
      db.organizationMember.count({ where: { organizationId: orgId, isActive: true } }),
    ])
    T.ok('events total/active/draft', d && d.events.total === total && d.events.active === active && d.events.draft === draft, { api: d && d.events, db: { total, active, draft } })
    T.ok('registrations total / this month', d && d.registrations.total === regs && d.registrations.thisMonth === regsMonth, { api: d && d.registrations, db: { regs, regsMonth } })
    T.ok('team members', d && d.teamMembers === team, { api: d && d.teamMembers, db: team })
    const pend = await db.registration.findMany({ where: { event: evWhere, status: 'PENDING' }, select: { metadata: true } })
    const awaiting = pend.filter((p) => !(p.metadata && p.metadata.holdExpiresAt && new Date(p.metadata.holdExpiresAt) > new Date())).length
    const pa = (d.pendingActions || []).find((p) => p.key === 'approvals')
    T.ok('pending approvals action count', (pa ? pa.count : 0) === awaiting, { api: pa, db: awaiting })
    const recent = (d.recentActivity || []).map((a) => a.description).join(' | ')
    T.ok('recent activity shows the latest organizer actions', /E2E-ORG|e2e-org|Venue update|Doors open|certificate/i.test(recent), recent.slice(0, 400))
    L.setState('overviewSnapshot', { total, active, regs, team })
  })

  await T.step('overview page (desktop + phone)', async () => {
    await L.goto(org, '/admin/org')
    await L.sleep(2000)
    const txt = await L.bodyText(org)
    const ov = L.state().overviewSnapshot
    T.ok('overview shows the registrations total', txt.includes(String(ov.regs)), ov)
    await L.shot(org, '07-overview')
    const ph = await L.session(browser, 'alice', L.PHONE)
    await L.goto(ph, '/admin/org')
    await L.sleep(1500)
    T.ok('overview has no horizontal scroll at 390px', (await L.overflowX(ph)) <= 1, await L.overflowX(ph))
    await L.shot(ph, '07-overview-phone')
    await L.closeSession(ph)
  })

  await T.step('org analytics match the DB (last 30 days)', async () => {
    const r = await L.api(org, 'GET', `/api/admin/org/${orgId}/analytics`)
    const ov = r.json && r.json.data && r.json.data.overview
    const from = new Date(Date.now() - 30 * 86400000)
    const regs = await db.registration.count({ where: { event: evWhere, createdAt: { gte: from, lte: new Date() } } }) // seed data has future-dated rows
    T.ok('analytics total registrations (30 days)', ov && Math.abs(ov.totalRegistrations - regs) <= 0, { api: ov && ov.totalRegistrations, db: regs })
    if (S.eventA) {
      const perf = (r.json.data.eventPerformance || []).find((e) => e.eventId === S.eventA.id)
      const ci = await db.checkIn.count({ where: { eventId: S.eventA.id } })
      T.ok('event A appears in event performance with its check-ins', perf && perf.checkIns === ci, perf)
      const ev = await L.api(org, 'GET', `/api/admin/org/${orgId}/events/${S.eventA.id}/analytics`)
      const evRate = ev.json && ev.json.data && ev.json.data.overview && ev.json.data.overview.attendanceRate
      T.ok('org analytics and event analytics give the same attendance % for event A', perf && evRate !== undefined && perf.attendance === evRate, { orgAnalytics: perf && perf.attendance, eventAnalytics: evRate })
      if (perf && evRate !== undefined && perf.attendance !== evRate) T.uxIssue('minor', '/admin/org/analytics vs /admin/org/events/[id]/analytics', `Attendance for the same event is ${perf.attendance}% on the org analytics page and ${evRate}% on the event analytics page: getOrgAnalytics divides check-ins by all registration rows (rejected, cancelled and unpaid included), getEventAnalytics by confirmed + checked-in.`, 'Use confirmed + checked-in as the denominator in getOrgAnalytics (src/lib/analytics.ts).')
    }
    await L.goto(org, '/admin/org/analytics')
    await L.sleep(2000)
    T.ok('analytics page renders', !(await L.bodyText(org)).includes('Failed to load'))
    await L.shot(org, '07-analytics')
    if (S.eventA) {
      await L.goto(org, `/admin/org/events/${S.eventA.id}/analytics`)
      await L.sleep(2000)
      const txt = await L.bodyText(org)
      T.ok('event analytics page renders with check-ins', /check/i.test(txt) && !txt.includes('Failed to load'))
      await L.shot(org, '07-event-analytics')
    }
  })

  await T.step('billing usage is real', async () => {
    const r = await L.api(org, 'GET', `/api/admin/org/${orgId}/billing/usage`)
    const u = Object.fromEntries(((r.json && r.json.data && r.json.data.usage) || []).map((x) => [x.key, x]))
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const orgEvents = await db.event.count({ where: { ...evWhere, createdAt: { gte: monthStart } } })
    const entEvents = await db.event.count({ where: { OR: [{ enterpriseId }, { organization: { enterpriseId } }], deletedAt: null, createdAt: { gte: monthStart } } })
    const team = await db.organizationMember.count({ where: { organizationId: orgId, isActive: true } })
    T.ok('team members used = active members', u.teamMembers && u.teamMembers.used === team, { api: u.teamMembers, db: team })
    // The Free limit is shared across the enterprise (the plan belongs to it); cancelled
    // events and templates don't count (lib/subscription.ts eventsThisMonthWhere).
    const counted = (await db.event.findMany({ where: { OR: [{ enterpriseId }, { organization: { enterpriseId } }], deletedAt: null, status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } }, select: { settings: true } }))
      .filter((e) => !(e.settings && e.settings.isTemplate === true)).length
    T.ok('events used = enterprise events created this month (not cancelled, not templates)', u.events && u.events.used === (enterpriseId ? counted : orgEvents), { api: u.events && u.events.used, db: enterpriseId ? counted : orgEvents })
    const blocked = L.state().creationBlockedByPlan
    T.ok('billing shows the same event usage that blocks creating events', !blocked || (u.events && u.events.used >= u.events.limit), { billing: u.events, enforcedEnterpriseCount: entEvents, blockedWith: blocked })
    if (blocked && u.events && u.events.used < u.events.limit) T.uxIssue('major', '/admin/org/billing', `Billing says "Events this month ${u.events.used} / ${u.events.limit}" for Tech Club, but creating an event is refused with "${blocked}" because the limit is enforced on the whole enterprise (${entEvents} events). The organizer sees headroom that does not exist.`, 'Use the same scope for the usage meter and the enforcement (both in checkUsageLimits callers), and name the scope ("Demo University plan: 8 / 5 events").')
    await L.goto(org, '/admin/org/billing')
    await L.sleep(2000)
    const txt = await L.bodyText(org)
    T.ok('billing page shows the team member usage', txt.includes(String(team)))
    await L.shot(org, '07-billing')
  })

  await T.step('audit log lists the organizer actions', async () => {
    const r = await L.api(org, 'GET', `/api/admin/org/${orgId}/audit-logs?limit=100`)
    const rows = (r.json && r.json.data) || []
    const has = (re) => rows.some((x) => re.test(x.description || ''))
    T.ok('event published', has(/Published event: E2E-ORG/))
    T.ok('event updated', has(/Updated event: E2E-ORG/))
    T.ok('event duplicated', has(/Duplicated event: E2E-ORG/))
    T.ok('event cancelled with reason', has(/Cancelled event: E2E-ORG.*Reason/))
    T.ok('registration approved / rejected', has(/^CONFIRMED registration/) && has(/^REJECTED registration/))
    T.ok('participant added manually', has(/^Added e2e-org-walkin-.* to E2E-ORG/))
    T.ok('certificate revoked / restored', has(/Revoked certificate/) && has(/Restored certificate/))
    T.ok('email sent', has(/Sent email "E2E-ORG/))
    T.ok('announcement posted', has(/Posted announcement: E2E-ORG/))
    T.ok('member added, role changed, removed', has(/Added e2e-org-member-/) && has(/Changed role from Event Manager to Coordinator/) && has(/Removed member from organization/))
    T.ok('settings change logged', has(/Updated organization settings/))
    T.ok('check-in recorded', rows.some((x) => x.action === 'CHECK_IN' || /check-in|checked in/i.test(x.description || '')), 'no check-in or undo rows in the org audit log')
    await L.goto(org, '/admin/org/audit-logs')
    await L.sleep(1500)
    const search = await org.$('input[placeholder="Search by person, entity or description"]')
    if (search) { await search.type('E2E-ORG'); await L.sleep(2000) }
    const txt = await L.bodyText(org)
    T.ok('audit log page search finds the E2E actions', txt.includes('E2E-ORG'))
    await L.shot(org, '07-audit-log')
  })
  await L.closeSession(org)
})
