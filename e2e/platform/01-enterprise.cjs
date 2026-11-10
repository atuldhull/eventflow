// Enterprise admin end to end (API + DB), on a temporary "E2E-ENT University <run>" enterprise.
// A university events office: creates clubs (orgs), edits them, manages members, sets rules,
// approves club events, reads payments/registrations/audit with CSV export, and billing.
// Usage: node e2e/platform/01-enterprise.cjs        (E2E_KEEP=1 skips the cleanup)
'use strict'
const L = require('./lib.cjs')
const { db, PREFIX, NAME_PREFIX } = L

const t = L.makeT('01-enterprise')
const run = L.runId()
const SLUG = `${PREFIX}${run}`
const ENT_NAME = `${NAME_PREFIX} University ${run}`
const anon = new L.Client('anon')

async function main() {
  if (!(await L.serverUp())) throw new Error('dev server not responding on ' + L.BASE)
  const p = db()

  // ── Fixtures ───────────────────────────────────────────────────────────────
  t.section('Setup')
  const owner = await L.createUser(`owner-${run}`, { name: `E2E Owner ${run}` })
  const mgr = await L.createUser(`mgr-${run}`, { name: '@SUM(1+1) Manager' }) // formula-looking name for the audit CSV
  const orgadmin = await L.createUser(`orgadmin-${run}`, { name: `E2E Club Admin ${run}` })
  const member = await L.createUser(`member-${run}`, { name: `E2E Member ${run}` })
  const att1 = await L.createUser(`att1-${run}`, { name: '=HYPERLINK("http://evil.example","x")' })
  const att2 = await L.createUser(`att2-${run}`, { name: `Plain Attendee ${run}` })
  const admin = await L.loginAs('admin')

  // Super admin creates the enterprise with a university owner (the owner is not a super admin)
  const created = await admin.post('/api/super-admin/enterprises', {
    name: ENT_NAME, slug: SLUG, email: `${SLUG}@test.local`, type: 'UNIVERSITY', ownerEmail: owner.email,
  })
  if (!t.ok('super admin creates the enterprise (201)', created.status === 201, created.body)) throw new Error('cannot continue')
  const ENT = created.body.data.id
  const api = (s) => `/api/admin/enterprise/${ENT}${s}`

  const ownerC = await L.loginEmail(owner.email)
  const before = await ownerC.get(api('/settings'))
  t.ok('a newly created enterprise\'s owner can open it straight away', before.status === 200,
    `GET settings as owner -> ${before.status} (super-admin create stores ownerId but adds no EnterpriseMember row; owner has no access until invited)`)
  const ownerPerm = await ownerC.get(`/api/auth/permissions?enterpriseId=${ENT}`)
  t.ok('the owner sees the enterprise in their workspace list', (ownerPerm.body.accessibleEnterprises || []).some((e) => e.id === ENT), ownerPerm.body.accessibleEnterprises)

  // The owner is a member from the start (fixed), so inviting them again is refused as a duplicate
  const inv = await admin.post('/api/members/invite', { email: owner.email, role: 'ENTERPRISE_ADMIN', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('the owner is already a member (invite again -> 409 "already a member")', inv.status === 409 && /already a member/i.test(inv.body && inv.body.message), inv.body)
  const s0 = await ownerC.get(api('/settings'))
  t.ok('owner then opens enterprise settings (isOwner=true)', s0.status === 200 && s0.body.data.isOwner === true, s0.body)

  // ── Organizations ───────────────────────────────────────────────────────────
  t.section('Organizations: create / list / search')
  const orgIds = {}
  for (const [k, cat] of [['a', 'TECHNICAL'], ['b', 'CULTURAL'], ['c', 'SPORTS']]) {
    const r = await ownerC.post(api('/organizations'), {
      name: `${NAME_PREFIX} Club ${k.toUpperCase()} ${run}`, slug: `${SLUG}-club-${k}`, category: cat,
      email: `club-${k}@${SLUG}.example.edu`, description: `Club ${k} of the e2e university`,
    })
    t.ok(`create org Club ${k.toUpperCase()} (201)`, r.status === 201, r.body)
    orgIds[k] = r.body && r.body.data && r.body.data.id
  }
  const badSlug = await ownerC.post(api('/organizations'), { name: `${NAME_PREFIX} Bad ${run}`, slug: 'Bad Slug!', category: 'OTHER', email: 'x@example.edu' })
  t.ok('invalid slug is refused (400)', badSlug.status === 400, badSlug.status)
  const dup = await ownerC.post(api('/organizations'), { name: `${NAME_PREFIX} Dup ${run}`, slug: `${SLUG}-club-a`, category: 'OTHER', email: 'x@example.edu' })
  t.ok('duplicate slug is refused (409)', dup.status === 409, dup.status)
  const list = await ownerC.get(api('/organizations?limit=50'))
  t.eq('org list total = 3', list.body.pagination && list.body.pagination.total, 3)
  const srch = await ownerC.get(api(`/organizations?search=${encodeURIComponent('club b')}`))
  t.ok('org search "club b" finds exactly Club B', srch.body.data.length === 1 && srch.body.data[0].id === orgIds.b, srch.body.data.map((o) => o.name))
  const dbOrgs = await p.organization.count({ where: { enterpriseId: ENT, deletedAt: null } })
  t.eq('DB: 3 orgs linked to the enterprise', dbOrgs, 3)
  const auditCreate = await ownerC.get(api('/audit-logs?search=Created%20organization'))
  t.ok('enterprise audit log lists the 3 org creations', (auditCreate.body.data || []).length >= 3, auditCreate.body.pagination)

  // ── Edit org (logo upload) ─────────────────────────────────────────────────
  t.section('Organizations: edit + logo upload')
  const up = await L.uploadPng(ownerC)
  t.ok('upload a PNG logo (200, /uploads/ url)', up.status === 200 && /^\/uploads\//.test(up.body.data.url), up.body)
  const logo = up.body && up.body.data && up.body.data.url
  const newName = `${NAME_PREFIX} Club A Renamed ${run}`
  const ed = await ownerC.patch(api(`/organizations/${orgIds.a}`), { name: newName, logo, city: 'Pune', primaryColor: '#112233' })
  t.ok('PATCH org name/logo/city/colour (200)', ed.status === 200, ed.body)
  const got = await ownerC.get(api(`/organizations/${orgIds.a}`))
  t.ok('org GET reflects the edit', got.body.data.name === newName && got.body.data.logo === logo && got.body.data.city === 'Pune', got.body.data)
  const pub = await anon.get(`/api/public/organizations/${SLUG}-club-a`)
  t.ok('public org profile shows the new name and logo', pub.status === 200 && JSON.stringify(pub.body).includes(newName) && JSON.stringify(pub.body).includes(logo), pub.status)
  const pubPage = await anon.get(`/org/${SLUG}-club-a`)
  t.ok('public /org/<slug> page responds 200', pubPage.status === 200, pubPage.status)
  for (const [label, body] of [['javascript: logo', { logo: 'javascript:alert(1)' }], ['http: logo', { logo: 'http://insecure.example/x.png' }], ['ftp website', { website: 'ftp://x.example' }], ['bad colour', { primaryColor: 'red' }]]) {
    const r = await ownerC.patch(api(`/organizations/${orgIds.a}`), body)
    t.ok(`org PATCH refuses ${label} (400)`, r.status === 400, r.status)
  }
  const demoOrg = await p.organization.findFirst({ where: { slug: 'tech-club' }, select: { id: true } })
  if (demoOrg) {
    const cross = await ownerC.patch(api(`/organizations/${demoOrg.id}`), { city: 'Hacked' })
    t.ok('cannot edit another enterprise\'s org through this enterprise (404)', cross.status === 404, cross.status)
  }

  // ── Members ────────────────────────────────────────────────────────────────
  t.section('Members: invite / role / remove / tabs / search / owner protection')
  const invOrgAdmin = await ownerC.post('/api/members/invite', { email: orgadmin.email, role: 'ORG_ADMIN', entityType: 'ORGANIZATION', entityId: orgIds.a })
  t.ok('enterprise admin makes a club admin (ORG_ADMIN of Club A)', invOrgAdmin.status === 201, invOrgAdmin.body)
  const invMember = await ownerC.post('/api/members/invite', { email: member.email, role: 'COORDINATOR', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('invite existing user as Coordinator (201)', invMember.status === 201, invMember.body)
  const invAgain = await ownerC.post('/api/members/invite', { email: member.email, role: 'COORDINATOR', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('inviting an active member again is refused (409)', invAgain.status === 409, invAgain.status)
  const invMgr = await ownerC.post('/api/members/invite', { email: mgr.email, role: 'ENTERPRISE_MANAGER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('invite Enterprise Manager (201)', invMgr.status === 201, invMgr.body)
  const coAdmin = await ownerC.post('/api/members/invite', { email: `${PREFIX}coadmin-${run}@test.local`, role: 'ENTERPRISE_ADMIN', entityType: 'ENTERPRISE', entityId: ENT })
  // Co-admins are allowed (decided in the earlier round): a university can have more than one full admin; the owner stays protected
  t.ok('an enterprise admin can add a co-admin (201)', coAdmin.status === 201, coAdmin.body)
  const ghostEmail = `${PREFIX}ghost-${run}@test.local`
  const ghost = await ownerC.post('/api/members/invite', { email: ghostEmail, role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ENT })
  const allMembers = async (status) => (await ownerC.get(api(`/members?status=${status}&limit=100`))).body
  const act1 = await allMembers('active'); const ina1 = await allMembers('inactive'); const pen1 = await allMembers('pending')
  const ghostTracked = [...act1.data, ...ina1.data, ...(pen1.data || [])].some((m) => (m.email || '').toLowerCase() === ghostEmail.toLowerCase())
  t.ok('invite to an email with no account is tracked (pending list)', ghost.status === 201 && ghostTracked,
    `API said ${ghost.status} "${ghost.body && ghost.body.message}"; pending=${JSON.stringify((pen1.data || []).map((m) => m.email))}`)
  const ownerRow = act1.data.find((m) => m.userId === owner.id)
  t.ok('members list marks the owner (isOwner, canManage=false)', ownerRow && ownerRow.isOwner && !ownerRow.canManage, ownerRow)
  // the co-admin's email has no account yet, so they wait on the Pending tab with the ghost invite
  t.eq('active count = 3 (owner, member, manager)', act1.counts.active, 3)
  t.ok('pending list holds the co-admin and the ghost invite', (pen1.data || []).length >= 2, (pen1.data || []).map((m) => m.email))
  const memRow = act1.data.find((m) => m.userId === member.id)
  const mgrRow = act1.data.find((m) => m.userId === mgr.id)
  const role1 = await ownerC.patch(`/api/members/${memRow.id}/role`, { role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('change member role Coordinator -> Viewer (200)', role1.status === 200, role1.body)
  const memDb = await p.enterpriseMember.findUnique({ where: { id: memRow.id } })
  t.eq('DB reflects the new role', memDb.role, 'VIEWER')
  const upRole = await ownerC.patch(`/api/members/${memRow.id}/role`, { role: 'ENTERPRISE_ADMIN', entityType: 'ENTERPRISE', entityId: ENT })
  // Promoting to Enterprise Admin is allowed for an admin (co-admins); put the role back for the rest of the test
  t.ok('an admin can promote to Enterprise Admin (200)', upRole.status === 200, upRole.status)
  await ownerC.patch(`/api/members/${memRow.id}/role`, { role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ENT })
  // Owner protection
  const saRole = await admin.patch(`/api/members/${ownerRow.id}/role`, { role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('even a super admin cannot re-role the owner (403)', saRole.status === 403 && /owner/i.test(saRole.body.message), saRole.body)
  const saRemove = await admin.del(`/api/members/${ownerRow.id}/remove`, { entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('even a super admin cannot remove the owner (403)', saRemove.status === 403 && /owner/i.test(saRemove.body.message), saRemove.body)
  const selfRole = await ownerC.patch(`/api/members/${ownerRow.id}/role`, { role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('owner cannot change own role (400)', selfRole.status === 400, selfRole.status)
  const mgrC = await L.loginEmail(mgr.email)
  const mgrRemoveOwner = await mgrC.del(`/api/members/${ownerRow.id}/remove`, { entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('manager cannot remove the owner (403)', mgrRemoveOwner.status === 403, mgrRemoveOwner.status)
  const mgrRemoveMgr = await ownerC.patch(`/api/members/${mgrRow.id}/role`, { role: 'ENTERPRISE_MANAGER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('setting the same role again is accepted', mgrRemoveMgr.status === 200, mgrRemoveMgr.status)
  // Remove + tabs + search + loss of access
  const memberC = await L.loginEmail(member.email)
  const memBefore = await memberC.get(api('/events'))
  t.ok('member (Viewer) can list enterprise events while active', memBefore.status === 200, memBefore.status)
  const memHub = await memberC.get(api('/dashboard-stats'))
  t.ok('an enterprise-level Viewer can load the enterprise hub numbers', memHub.status === 200,
    `dashboard-stats -> ${memHub.status}: VIEWER/COORDINATOR/FINANCE_MANAGER lack enterprise:view, yet the invite dialog offers them at enterprise level`)
  const rm = await ownerC.del(`/api/members/${memRow.id}/remove`, { entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('remove member (200)', rm.status === 200, rm.body)
  const act2 = await allMembers('active'); const ina2 = await allMembers('inactive')
  t.ok('Active tab no longer lists them; Removed tab does', !act2.data.some((m) => m.userId === member.id) && ina2.data.some((m) => m.userId === member.id), { active: act2.counts, ids: ina2.data.map((m) => m.email) })
  t.eq('counts after removal {active:2, inactive:1}', { active: act2.counts.active, inactive: act2.counts.inactive }, { active: 2, inactive: 1 })
  const sIn = (await ownerC.get(api(`/members?status=inactive&search=${encodeURIComponent(`member-${run}`)}`))).body
  t.ok('search in Removed tab finds the member by email', sIn.data.length === 1, sIn.data.length)
  const sNo = (await ownerC.get(api('/members?status=active&search=zz-no-such-person'))).body
  t.ok('search with no match returns 0', sNo.data.length === 0 && sNo.pagination.total === 0, sNo.pagination)
  const sName = (await ownerC.get(api(`/members?status=active&search=${encodeURIComponent(`E2E Owner ${run}`)}`))).body
  t.ok('search by name finds the owner', sName.data.length === 1 && sName.data[0].userId === owner.id, sName.data.length)
  const memAfter = await memberC.get(api('/events'))
  t.ok('removed member loses API access at once (403)', memAfter.status === 403, memAfter.status)
  const removedRm = await ownerC.del(`/api/members/${memRow.id}/remove`, { entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('removing an already removed member does not report success', removedRm.status >= 400, `${removedRm.status} ${removedRm.body && removedRm.body.message}`)
  const readd = await ownerC.post('/api/members/invite', { email: member.email, role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('re-inviting a removed member brings them back (201)', readd.status === 201 && /re-?added|added/i.test(readd.body.message), readd.body)
  const act3 = await allMembers('active')
  t.eq('counts after re-add {active:3, inactive:0}', { active: act3.counts.active, inactive: act3.counts.inactive }, { active: 3, inactive: 0 })
  const auditRole = await ownerC.get(api('/audit-logs?search=Changed%20role'))
  t.ok('audit log has the role change', (auditRole.body.data || []).length >= 1, auditRole.body.pagination)

  // ── Settings + branding ─────────────────────────────────────────────────────
  t.section('Settings + branding')
  const setRes = await ownerC.patch(api('/settings'), {
    description: 'E2E university description', phone: '+91 99999 00000', website: 'https://e2e.example.edu', type: 'UNIVERSITY',
    settings: { requireEventApproval: true },
  })
  t.ok('save settings incl. "Require event approval" (200)', setRes.status === 200, setRes.body)
  const setGet = await ownerC.get(api('/settings'))
  t.ok('settings reload shows the saved values', setGet.body.data.description === 'E2E university description' && setGet.body.data.website === 'https://e2e.example.edu' && setGet.body.data.settings.requireEventApproval === true, setGet.body.data)
  for (const [label, body] of [['ftp website', { website: 'ftp://x.example' }], ['bad email', { email: 'not-an-email' }], ['1-char name', { name: 'x' }], ['bad type', { type: 'CASINO' }]]) {
    const r = await ownerC.patch(api('/settings'), body)
    t.ok(`settings refuse ${label} (400)`, r.status === 400, r.status)
  }
  const br = await ownerC.patch(api('/branding'), { primaryColor: '#0a7f5a', secondaryColor: '#fafafa', logo })
  t.ok('save branding colours + logo (200)', br.status === 200, br.body)
  const brGet = await ownerC.get(api('/branding'))
  t.ok('branding reload shows the saved values', brGet.body.data.primaryColor === '#0a7f5a' && brGet.body.data.logo === logo, brGet.body.data)
  t.ok('branding refuses a non-hex colour (400)', (await ownerC.patch(api('/branding'), { primaryColor: 'red' })).status === 400)
  t.ok('branding refuses a javascript: banner (400)', (await ownerC.patch(api('/branding'), { banner: 'javascript:alert(1)' })).status === 400)
  await ownerC.patch(api('/branding'), { customDomain: 'evil-e2e.example.com' })
  await ownerC.patch(api('/settings'), { customDomain: 'evil-e2e.example.com' })
  const entDb1 = await p.enterprise.findUnique({ where: { id: ENT }, select: { customDomain: true } })
  t.eq('customDomain cannot be set through branding/settings (still null)', entDb1.customDomain, null)
  const dv = await ownerC.post(api('/domain/verify'), { domain: `${SLUG}.example.invalid` })
  t.ok('domain verify without DNS says not verified', dv.status === 200 && dv.body.data && dv.body.data.verified === false, dv.body)
  const entDb2 = await p.enterprise.findUnique({ where: { id: ENT }, select: { customDomain: true } })
  t.eq('customDomain still null after failed DNS verification', entDb2.customDomain, null)
  const pubEnt = await anon.get(`/api/public/enterprises/${SLUG}`)
  t.ok('public enterprise profile responds and lists the clubs', pubEnt.status === 200 && JSON.stringify(pubEnt.body).includes(newName), pubEnt.status)

  // ── Approval flow ──────────────────────────────────────────────────────────
  t.section('Approval flow (require approval ON)')
  const clubC = await L.loginEmail(orgadmin.email)
  const evA = await clubC.post(`/api/admin/org/${orgIds.a}/events`, L.eventBody(`${SLUG}-ev-approve`, `${NAME_PREFIX} Approve Me ${run}`, { status: 'PUBLISHED' }))
  t.ok('club admin "publishes" -> 201 with status PENDING_APPROVAL', evA.status === 201 && evA.body.data.status === 'PENDING_APPROVAL', evA.body && (evA.body.data ? evA.body.data.status : evA.body))
  t.ok('club admin is told it needs approval', /approv/i.test(evA.body.message || ''), evA.body.message)
  const evAId = evA.body.data && evA.body.data.id
  const evASlug = evA.body.data && evA.body.data.slug
  t.ok('pending event is NOT public (GET /api/events/<slug> 404)', (await anon.get(`/api/events/${evASlug}`)).status === 404)
  const listPending = await anon.get(`/api/events?search=${encodeURIComponent(`Approve Me ${run}`)}`)
  t.ok('pending event is NOT in the public listing', !JSON.stringify(listPending.body).includes(evASlug), listPending.status)
  const notifs = await p.notification.findMany({ where: { eventId: evAId, title: 'Event awaiting approval' }, select: { userId: true } })
  t.ok('enterprise admin + manager are notified', notifs.some((n) => n.userId === owner.id) && notifs.some((n) => n.userId === mgr.id), notifs)
  const entPending = await ownerC.get(api('/events?status=PENDING_APPROVAL'))
  t.ok('enterprise Events list filters to the pending event', entPending.body.data.some((e) => e.id === evAId), entPending.body.data.map((e) => e.title))
  const selfApprove = await clubC.post(api(`/events/${evAId}/approve`), { action: 'approve' })
  t.ok('club admin cannot approve their own event (403)', selfApprove.status === 403, selfApprove.status)
  const appr = await ownerC.post(api(`/events/${evAId}/approve`), { action: 'approve' })
  t.ok('enterprise admin approves (200)', appr.status === 200, appr.body)
  const evADb = await p.event.findUnique({ where: { id: evAId }, select: { status: true, publishedAt: true } })
  t.ok('DB: PUBLISHED with publishedAt', evADb.status === 'PUBLISHED' && !!evADb.publishedAt, evADb)
  t.ok('approved event is public (200)', (await anon.get(`/api/events/${evASlug}`)).status === 200)
  const listPub = await anon.get(`/api/events?search=${encodeURIComponent(`Approve Me ${run}`)}`)
  t.ok('approved event appears in the public listing', JSON.stringify(listPub.body).includes(evASlug), listPub.status)
  const okNotif = await p.notification.count({ where: { userId: orgadmin.id, title: 'Event approved', eventId: evAId } })
  t.ok('club admin gets "Event approved"', okNotif >= 1, okNotif)
  const apprAgain = await ownerC.post(api(`/events/${evAId}/approve`), { action: 'approve' })
  t.ok('approving a non-pending event is refused (404)', apprAgain.status === 404, apprAgain.status)
  const auditAppr = await ownerC.get(api('/audit-logs?action=APPROVE'))
  t.ok('audit log has the APPROVE entry', (auditAppr.body.data || []).some((a) => /Approve Me/.test(a.description || '')), auditAppr.body.data && auditAppr.body.data.length)

  // Reject path: draft -> publish route -> pending -> reject
  const evR = await clubC.post(`/api/admin/org/${orgIds.a}/events`, L.eventBody(`${SLUG}-ev-reject`, `${NAME_PREFIX} Reject Me ${run}`, { status: 'DRAFT' }))
  const evRId = evR.body.data && evR.body.data.id
  const pubR = await clubC.post(`/api/admin/org/${orgIds.a}/events/${evRId}/publish`, {})
  t.ok('publish route on a draft -> PENDING_APPROVAL', pubR.status === 200 && pubR.body.data && pubR.body.data.status === 'PENDING_APPROVAL', pubR.body)
  const auditSubmit = await ownerC.get(api(`/audit-logs?search=${encodeURIComponent('Submitted event for approval')}`))
  t.ok('enterprise audit log shows the club\'s submission for approval', (auditSubmit.body.data || []).length >= 1,
    'publish route writes the audit entry with organizationId only (no enterpriseId), so the enterprise audit log never shows it')
  const rej = await ownerC.post(api(`/events/${evRId}/approve`), { action: 'reject', reason: 'Clashes with exams' })
  t.ok('enterprise admin rejects with a reason (200)', rej.status === 200, rej.body)
  const evRDb = await p.event.findUnique({ where: { id: evRId }, select: { status: true } })
  t.eq('DB: rejected event back to DRAFT', evRDb.status, 'DRAFT')
  t.ok('rejected event is not public (404)', (await anon.get(`/api/events/${evR.body.data.slug}`)).status === 404)
  const rejNotif = await p.notification.findFirst({ where: { userId: orgadmin.id, title: 'Event not approved', eventId: evRId } })
  t.ok('club admin is told why it was rejected', rejNotif && /Clashes with exams/.test(rejNotif.message), rejNotif)
  const auditRej = await ownerC.get(api('/audit-logs?action=REJECT'))
  t.ok('audit log has the REJECT entry', (auditRej.body.data || []).length >= 1)
  // Enterprise admin publishes directly (no approval needed for approvers)
  const evDirect = await ownerC.post(`/api/admin/org/${orgIds.b}/events`, L.eventBody(`${SLUG}-ev-direct`, `${NAME_PREFIX} Direct ${run}`, { status: 'PUBLISHED' }))
  t.ok('enterprise admin publishing in a club goes live directly', evDirect.status === 201 && evDirect.body.data.status === 'PUBLISHED', evDirect.body.data && evDirect.body.data.status)
  // Rule off -> club admin publishes directly
  await ownerC.patch(api('/settings'), { settings: { requireEventApproval: false } })
  const evOff = await clubC.post(`/api/admin/org/${orgIds.a}/events`, L.eventBody(`${SLUG}-ev-off`, `${NAME_PREFIX} No Rule ${run}`, { status: 'PUBLISHED' }))
  t.ok('with the rule off, club admin publishes directly', evOff.status === 201 && evOff.body.data.status === 'PUBLISHED', evOff.body.data && evOff.body.data.status)

  // ── Registrations / payments / audit + CSV ──────────────────────────────────
  t.section('Registrations, payments, audit: search + CSV export')
  const tt = await p.ticketType.findFirst({ where: { eventId: evAId } })
  const r1 = await p.registration.create({ data: { registrationNumber: `E2E-${run}-R1`, eventId: evAId, userId: att1.id, ticketTypeId: tt.id, status: 'CONFIRMED' } })
  const r2 = await p.registration.create({ data: { registrationNumber: `E2E-${run}-R2`, eventId: evAId, userId: att2.id, ticketTypeId: tt.id, status: 'PENDING' } })
  await p.payment.create({ data: { paymentNumber: `E2E-${run}-P1`, registrationId: r1.id, userId: att1.id, eventId: evAId, amount: 499, status: 'COMPLETED', method: 'RAZORPAY', paidAt: new Date() } })
  await p.payment.create({ data: { paymentNumber: `E2E-${run}-P2`, registrationId: r2.id, userId: att2.id, eventId: evAId, amount: 499, status: 'PENDING', method: 'RAZORPAY' } })
  await p.event.update({ where: { id: evAId }, data: { currentRegistrations: 2 } })
  const regs = await ownerC.get(api('/registrations?limit=50'))
  t.ok('registrations list: 2 rows, stats {total 2, confirmed 1, pending 1}', regs.body.data.length === 2 && regs.body.stats.total === 2 && regs.body.stats.confirmed === 1 && regs.body.stats.pending === 1, regs.body.stats)
  const regSearch = await ownerC.get(api(`/registrations?search=${encodeURIComponent(att2.email)}`))
  t.ok('registration search by email -> 1', regSearch.body.data.length === 1, regSearch.body.data.length)
  const regSearchNo = await ownerC.get(api(`/registrations?search=E2E-${run}-R1`))
  t.ok('registration search by number -> 1', regSearchNo.body.data.length === 1, regSearchNo.body.data.length)
  const regCsv = await ownerC.get(api('/registrations/export'))
  const regRows = L.parseCsv(regCsv.text)
  t.ok('registrations CSV: text/csv attachment, header + 2 rows', /text\/csv/.test(regCsv.ct) && /attachment/.test(regCsv.headers.get('content-disposition') || '') && regRows.length === 3, { ct: regCsv.ct, rows: regRows.length })
  const formulaCell = regRows.flat().find((c) => c.includes('HYPERLINK'))
  t.ok('registrations CSV is formula-safe (=HYPERLINK cell prefixed with \')', formulaCell && formulaCell.startsWith("'="), formulaCell)
  const regCsvS = L.parseCsv((await ownerC.get(api(`/registrations/export?search=${encodeURIComponent(att2.email)}`))).text)
  t.ok('registrations CSV honours the search (1 row)', regCsvS.length === 2, regCsvS.length)
  const pays = await ownerC.get(api('/payments?limit=50'))
  t.ok('payments: revenue 499, pending 1, 2 rows', pays.body.stats.totalRevenue === 499 && pays.body.stats.pending === 1 && pays.body.data.length === 2, pays.body.stats)
  const paySearch = await ownerC.get(api(`/payments?search=E2E-${run}-P1`))
  t.ok('payment search by number -> 1', paySearch.body.data.length === 1, paySearch.body.data.length)
  const payCsv = await ownerC.get(api('/payments/export'))
  const payRows = L.parseCsv(payCsv.text)
  t.ok('payments CSV: header + 2 rows, formula-safe', payRows.length === 3 && payRows.flat().filter((c) => c.includes('HYPERLINK')).every((c) => c.startsWith("'=")), { rows: payRows.length })
  // Manager does something so their formula-looking name lands in the audit log
  const mgrEdit = await mgrC.patch(api(`/organizations/${orgIds.b}`), { description: 'Edited by the manager' })
  t.ok('enterprise manager can edit a club (200)', mgrEdit.status === 200, mgrEdit.status)
  const audCsv = await ownerC.get(api('/audit-logs/export'))
  const audRows = L.parseCsv(audCsv.text)
  const sumCell = audRows.flat().find((c) => c.includes('@SUM(1+1)'))
  t.ok('audit CSV is formula-safe (@SUM name prefixed)', /text\/csv/.test(audCsv.ct) && sumCell && sumCell.startsWith("'@"), sumCell)
  const audExport = await ownerC.get(api('/audit-logs?action=EXPORT'))
  t.ok('each export is itself audited (>= 3 EXPORT rows)', (audExport.body.data || []).length >= 3, audExport.body.data && audExport.body.data.length)
  const audSearch = await ownerC.get(api(`/audit-logs?search=${encodeURIComponent('check in')}`))
  t.ok('audit search accepts free text ("check in") without error', audSearch.status === 200, audSearch.status)

  // ── Dashboard numbers vs DB ─────────────────────────────────────────────────
  t.section('Dashboard + org detail numbers vs DB')
  const scope = { deletedAt: null, OR: [{ enterpriseId: ENT }, { organization: { enterpriseId: ENT } }] }
  const dash = await ownerC.get(api('/dashboard-stats'))
  const dbCounts = {
    orgCount: await p.organization.count({ where: { enterpriseId: ENT, isActive: true, deletedAt: null } }),
    eventCount: await p.event.count({ where: scope }),
    registrationCount: await p.registration.count({ where: { event: scope } }),
    totalRevenue: Number((await p.payment.aggregate({ where: { status: 'COMPLETED', registration: { event: scope } }, _sum: { amount: true } }))._sum.amount || 0),
  }
  t.eq('dashboard KPIs equal the DB', { orgCount: dash.body.data.orgCount, eventCount: dash.body.data.eventCount, registrationCount: dash.body.data.registrationCount, totalRevenue: dash.body.data.totalRevenue }, dbCounts)
  t.ok('dashboard recent activity lists enterprise actions', (dash.body.data.recentActivity || []).length > 0)
  const det = await ownerC.get(api(`/organizations/${orgIds.a}?include=details`))
  const dbA = {
    events: await p.event.count({ where: { organizationId: orgIds.a, deletedAt: null } }),
    members: await p.organizationMember.count({ where: { organizationId: orgIds.a, isActive: true } }),
    registrations: await p.registration.count({ where: { event: { organizationId: orgIds.a, deletedAt: null } } }),
    revenue: 499,
  }
  const s = det.body.data && det.body.data.stats
  t.eq('org detail stats equal the DB', s && { events: s.events, members: s.members, registrations: s.registrations, revenue: s.revenue }, dbA)
  // Deactivate a club: dashboard count drops, the club admin is locked out, then restored
  const deact = await ownerC.patch(api(`/organizations/${orgIds.a}`), { isActive: false })
  t.ok('deactivate Club A (200)', deact.status === 200)
  t.ok('club admin of a deactivated club loses access (403)', (await clubC.get(`/api/admin/org/${orgIds.a}/events`)).status === 403)
  const dash2 = await ownerC.get(api('/dashboard-stats'))
  t.eq('dashboard org count drops by 1', dash2.body.data.orgCount, dbCounts.orgCount - 1)
  const listAfter = await ownerC.get(api('/organizations'))
  if (listAfter.body.pagination.total !== dash2.body.data.orgCount) t.note(`Hub KPI "Organizations" (${dash2.body.data.orgCount}, active only) differs from the Organizations page total (${listAfter.body.pagination.total}, incl. inactive) with no label explaining it.`)
  await ownerC.patch(api(`/organizations/${orgIds.a}`), { isActive: true })
  t.ok('reactivated club admin regains access (200)', (await clubC.get(`/api/admin/org/${orgIds.a}/events`)).status === 200)
  const delC = await ownerC.del(api(`/organizations/${orgIds.c}`))
  t.ok('delete Club C (200)', delC.status === 200, delC.body)
  const listDel = await ownerC.get(api('/organizations'))
  t.eq('org list total = 2 after delete', listDel.body.pagination.total, 2)
  t.ok('deleted club is gone from the public site (404)', (await anon.get(`/api/public/organizations/${SLUG}-club-c`)).status === 404)

  // ── Billing ────────────────────────────────────────────────────────────────
  t.section('Billing (no Razorpay keys)')
  const bill = await ownerC.get(`/api/admin/billing?entityType=enterprise&entityId=${ENT}`)
  t.ok('billing loads (FREE plan)', bill.status === 200 && bill.body.data.subscription.plan === 'FREE', bill.body.data && bill.body.data.subscription)
  for (const plan of ['STARTER', 'PRO']) {
    const r = await ownerC.post('/api/admin/billing/subscribe', { plan, billingInterval: 'MONTHLY', entityType: 'enterprise', entityId: ENT })
    t.ok(`${plan} upgrade says payments are not configured (503)`, r.status === 503 && /not configured/i.test(r.body.message), r.body)
  }
  const entPlan = await ownerC.post('/api/admin/billing/subscribe', { plan: 'ENTERPRISE', billingInterval: 'MONTHLY', entityType: 'enterprise', entityId: ENT })
  t.ok('ENTERPRISE plan says contact sales (400)', entPlan.status === 400 && /contact sales/i.test(entPlan.body.message), entPlan.body)
  const mgrBill = await mgrC.post('/api/admin/billing/subscribe', { plan: 'PRO', billingInterval: 'MONTHLY', entityType: 'enterprise', entityId: ENT })
  t.ok('enterprise manager cannot change the plan (403)', mgrBill.status === 403, mgrBill.status)

  // ── Owner deletes the enterprise from its settings ──────────────────────────
  t.section('Owner deletes the enterprise (typed confirmation)')
  const mgrDel = await mgrC.del(api(''), { confirm: ENT_NAME })
  t.ok('a manager cannot delete the enterprise (403)', mgrDel.status === 403, mgrDel.status)
  const wrong = await ownerC.del(api(''), { confirm: 'wrong name' })
  t.ok('wrong confirmation is refused (400)', wrong.status === 400, wrong.body)
  const del = await ownerC.del(api(''), { confirm: ENT_NAME.toLowerCase() })
  t.ok('owner deletes with the name typed (200)', del.status === 200, del.body)
  const entDel = await p.enterprise.findUnique({ where: { id: ENT }, select: { deletedAt: true, isActive: true } })
  t.ok('soft delete: deletedAt set, inactive', !!entDel.deletedAt && entDel.isActive === false, entDel)
  t.ok('audit has "Deleted enterprise ... (enterprise-owner)"', (await p.auditLog.count({ where: { enterpriseId: ENT, action: 'DELETE', entityType: 'ENTERPRISE' } })) === 1)
  t.ok('owner loses access after delete (403/404)', [403, 404].includes((await ownerC.get(api('/settings'))).status))
  t.ok('club admin of a deleted enterprise loses access (403)', (await clubC.get(`/api/admin/org/${orgIds.a}/events`)).status === 403)
  const pubAfter = await anon.get(`/api/events/${evASlug}`)
  if (pubAfter.status === 200) t.note('Events of a deleted/deactivated enterprise\'s clubs stay public and open for registration (public event API does not check the enterprise).')
}

main()
  .catch((e) => t.ok('script aborted', false, e && (e.stack || e.message)))
  .finally(async () => {
    if (process.env.E2E_KEEP !== '1') await L.cleanupAll().catch((e) => console.error('cleanup failed', e))
    const fails = t.save()
    await db().$disconnect()
    process.exit(fails ? 1 : 0)
  })
