// Members: invite an e2e account (added directly), change role, role-rank rules (an Event Manager
// can't grant Org Admin or change an admin), what an Event Manager can do at the door, remove ->
// loses access -> restore, invite an unknown email (pending) -> cancel the invitation.
const L = require('./lib.cjs')

L.run('06-members', async (T, browser) => {
  const S = L.state()
  const db = L.db()
  const { orgId } = await L.orgIds()
  const anon = await L.session(browser, null)
  const member = await L.createAttendee(anon, 'member', 'E2E Org Member')
  await L.closeSession(anon)
  L.setState('member', member)
  const org = await L.session(browser, 'alice')
  const membership = () => db.organizationMember.findFirst({ where: { organizationId: orgId, userId: member.id } })
  const dialogSubmit = async () => { await L.clearToasts(org); await org.click('[role="dialog"] button[type="submit"]'); return L.waitToast(org) }
  // A dialog that just closed keeps its backdrop for the exit animation: wait it out, so
  // the click reaches the page and not the fading overlay.
  const settle = async () => {
    await org.waitForFunction(() => !document.querySelector('[role="dialog"], [data-base-ui-inert], [inert]'), { timeout: 5000 }).catch(() => {})
    await L.sleep(300)
  }
  const rowAction = async (name, item) => {
    await settle()
    await org.waitForSelector(`button[aria-label="Actions for ${name}"]`, { timeout: 15000 })
    await org.click(`button[aria-label="Actions for ${name}"]`)
    try {
      await L.clickText(org, item, '[role="menuitem"]', { timeout: 5000 })
    } catch (e) {
      const items = await org.$$eval('[role="menuitem"]', (els) => els.map((x) => x.innerText.trim())).catch(() => [])
      await L.shot(org, `06-rowaction-${item.replace(/\W+/g, '-')}`).catch(() => {})
      throw new Error(`${e.message}; open menu items: ${JSON.stringify(items)}; rows: ${JSON.stringify(await org.$$eval('button[aria-label^="Actions for"]', (els) => els.map((x) => x.getAttribute('aria-label'))))}`)
    }
  }

  await T.step('invite an existing account as Event Manager', async () => {
    await L.goto(org, '/admin/org/members')
    await L.clickText(org, 'Invite member')
    await org.waitForSelector('#invite-email')
    await L.typeInto(org, '#invite-email', member.email)
    await L.selectOption(org, '#invite-role', 'Event Manager')
    const toast = await dialogSubmit()
    T.ok('"added" toast', toast && /added|member/i.test(toast.text), toast)
    const m = await membership()
    T.ok('membership EVENT_MANAGER, active', m && m.role === 'EVENT_MANAGER' && m.isActive, m)
    T.ok('Active tab lists the member', await L.waitText(org, member.email, 15000))
    T.ok('audit: member added', !!(await db.auditLog.findFirst({ where: { organizationId: orgId, description: { contains: member.email } } })))
    await L.shot(org, '06-members-active')
  })

  await T.step('change role (Coordinator, then back)', async () => {
    await rowAction('E2E Org Member', 'Change role')
    await org.waitForSelector('#change-role')
    await org.click('#change-role')
    await org.waitForSelector('[role="option"]')
    const opts = await org.$$eval('[role="option"]', (x) => x.map((e) => e.innerText.trim()))
    T.ok('role list offers only roles below Org Admin', opts.length > 0 && !opts.includes('Organization Admin'), opts)
    await (await L.findByText(org, '[role="option"]', 'Coordinator', { exact: true })).click()
    await L.sleep(250)
    const toast = await dialogSubmit()
    T.ok('"Role updated" toast', toast && /role/i.test(toast.text), toast)
    T.ok('DB role COORDINATOR', (await membership()).role === 'COORDINATOR')
    await rowAction('E2E Org Member', 'Change role')
    await L.selectOption(org, '#change-role', 'Event Manager')
    await dialogSubmit()
    T.ok('DB role back to EVENT_MANAGER', (await membership()).role === 'EVENT_MANAGER')
  })

  await T.step('role-rank rules for an Event Manager', async () => {
    const em = await L.session(browser, member)
    const up = await L.api(em, 'POST', '/api/members/invite', { email: `${L.EMAIL_PREFIX}rank-${S.runId}@test.local`, role: 'ORG_ADMIN', entityType: 'ORGANIZATION', entityId: orgId })
    T.ok('Event Manager cannot grant ORG_ADMIN (403)', up.status === 403, up.json)
    const alice = await db.organizationMember.findFirst({ where: { organizationId: orgId, user: { email: 'alice@test.local' } } })
    const demote = await L.api(em, 'PATCH', `/api/members/${alice.id}/role`, { role: 'VIEWER', entityType: 'ORGANIZATION', entityId: orgId })
    T.ok("Event Manager cannot change the Org Admin's role", demote.status === 403, demote.json)
    const rm = await L.api(em, 'DELETE', `/api/members/${alice.id}/remove`, { entityType: 'ORGANIZATION', entityId: orgId })
    T.ok('Event Manager cannot remove the Org Admin', rm.status === 403 || rm.status === 405, rm.json)
    T.ok("alice's membership untouched", (await db.organizationMember.findUnique({ where: { id: alice.id } })).role === 'ORG_ADMIN')
    const coord = await L.api(em, 'POST', '/api/members/invite', { email: `${L.EMAIL_PREFIX}rank-${S.runId}@test.local`, role: 'COORDINATOR', entityType: 'ORGANIZATION', entityId: orgId })
    T.info(`Event Manager inviting a Coordinator: ${coord.status} ${coord.json && coord.json.message}`)
    await L.goto(em, '/admin/org/members')
    await L.sleep(1500)
    const inviteBtn = await L.findByText(em, 'button', 'Invite member', { timeout: 2000 })
    T.info(`Event Manager sees "Invite member": ${!!inviteBtn}`)
    // door: an event manager running the event cannot check people in
    const reg = S.eventA && await db.registration.findFirst({ where: { eventId: S.eventA.id, status: 'CONFIRMED' } })
    if (reg) {
      const ci = await L.api(em, 'POST', '/api/check-in', { method: 'MANUAL', registrationId: reg.id, eventId: S.eventA.id })
      T.info(`Event Manager manual check-in: ${ci.status} ${ci.json && ci.json.message}`)
      if (ci.status === 403) T.uxIssue('major', '/admin/org/events/[id]/check-in (Event Manager)', 'An Event Manager ("creates and manages events, registrations") cannot check anyone in: the role has CHECKIN_VIEW but not CHECKIN_PERFORM, so the person running the event gets 403 at the door while a Coordinator can. The check-in screen still opens for them.', 'Give EVENT_MANAGER CHECKIN_PERFORM (src/lib/permissions.ts), or hide the scan/check-in buttons for roles without it.')
      if (ci.status === 200) await L.api(L.state().volunteer ? org : org, 'POST', '/api/check-in/undo', { checkInId: ci.json.data.checkIn.id })
    }
    await L.closeSession(em)
  })

  await T.step('remove -> loses access -> restore', async () => {
    await L.goto(org, '/admin/org/members')
    await rowAction('E2E Org Member', 'Remove from team')
    const toast = await dialogSubmit()
    T.ok('remove toast', toast && /remov/i.test(toast.text), toast)
    T.ok('membership inactive', (await membership()).isActive === false)
    const em = await L.session(browser, member)
    const r = await L.api(em, 'GET', `/api/admin/org/${orgId}/events`)
    T.ok('removed member loses access to the org API (403)', r.status === 403, r.status)
    await L.closeSession(em)
    await settle(); await L.clickText(org, /^Removed/, '[role="tab"]')
    T.ok('Removed tab lists them', await L.waitText(org, member.email, 10000))
    await rowAction('E2E Org Member', 'Restore to the team')
    const t2 = await dialogSubmit()
    T.ok('restore toast', t2 && t2.type !== 'error', t2)
    const m = await membership()
    T.ok('membership active again with the same role', m.isActive && m.role === 'EVENT_MANAGER', m)
  })

  await T.step('invite an unknown email, then cancel the invitation', async () => {
    const email = `${L.EMAIL_PREFIX}pending-${S.runId}@test.local`
    await L.goto(org, '/admin/org/members')
    await L.clickText(org, 'Invite member')
    await org.waitForSelector('#invite-email')
    await L.typeInto(org, '#invite-email', email)
    await L.selectOption(org, '#invite-role', 'Coordinator')
    const toast = await dialogSubmit()
    T.ok('"Invitation sent" toast', toast && /invitation sent/i.test(toast.text), toast)
    const inv = async () => ((await db.organization.findUnique({ where: { id: orgId }, select: { settings: true } })).settings?.pendingInvites || []).find((i) => i.email === email)
    T.ok('pending invite stored', !!(await inv()))
    await settle(); await L.clickText(org, /^Pending/, '[role="tab"]')
    T.ok('Pending tab lists it', await L.waitText(org, email, 10000))
    await rowAction(email, 'Cancel invitation')
    const t2 = await dialogSubmit()
    T.ok('cancel toast', t2 && t2.type !== 'error', t2)
    T.ok('pending invite removed', !(await inv()))
  })

  await T.step('members page on a phone', async () => {
    const ph = await L.session(browser, 'alice', L.PHONE)
    await L.goto(ph, '/admin/org/members')
    await L.waitText(ph, member.email, 15000)
    T.ok('members page has no horizontal scroll at 390px', (await L.overflowX(ph)) <= 1, await L.overflowX(ph))
    await L.shot(ph, '06-members-phone')
    await L.closeSession(ph)
  })
  await L.closeSession(org)
})
