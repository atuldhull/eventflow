// Platform super admin end to end (API + DB): users (stats, role, ban), enterprises (verify,
// activate/deactivate, delete), events totals, subscriptions, messages, audit, dashboard.
// Works only on e2e-ent- users and an "E2E-ENT …" enterprise it creates; never touches demo data.
// Usage: node e2e/platform/02-super-admin.cjs        (E2E_KEEP=1 skips the cleanup)
'use strict'
const L = require('./lib.cjs')
const { db, PREFIX, NAME_PREFIX } = L

const t = L.makeT('02-super-admin')
const run = L.runId()
const SLUG = `${PREFIX}sa-${run}`
const ENT_NAME = `${NAME_PREFIX} Institute ${run}`
const anon = new L.Client('anon')

const startOfMonth = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) }

async function userKpisFromDb(p) {
  const base = { deletedAt: null }
  const [total, active, banned, newThisMonth] = await Promise.all([
    p.user.count({ where: base }),
    p.user.count({ where: { ...base, isActive: true, isBanned: false } }),
    p.user.count({ where: { ...base, isBanned: true } }),
    p.user.count({ where: { ...base, createdAt: { gte: startOfMonth() } } }),
  ])
  return { total, active, banned, newThisMonth }
}

async function main() {
  if (!(await L.serverUp())) throw new Error('dev server not responding on ' + L.BASE)
  const p = db()
  const admin = await L.loginAs('admin')
  const adminId = admin.user.id

  t.section('Setup')
  const victim = await L.createUser(`victim-${run}`, { name: `E2E Victim ${run}` })
  const tempSa = await L.createUser(`tempsa-${run}`, { name: `E2E Temp SA ${run}` })
  const entMember = await L.createUser(`entmember-${run}`, { name: `E2E Ent Member ${run}` })
  t.ok('fixtures created', !!victim.id && !!tempSa.id && !!entMember.id)

  // ── Users ──────────────────────────────────────────────────────────────────
  t.section('Users: KPIs, search, filters')
  const u1 = await admin.get('/api/super-admin/users?limit=5')
  const k1 = await userKpisFromDb(p)
  t.eq('user KPIs (total/active/banned/new this month) equal the DB', u1.body.stats, k1)
  const us = await admin.get(`/api/super-admin/users?search=${encodeURIComponent(`-${run}@`)}`)
  t.eq('search by email fragment finds the 3 e2e users', us.body.pagination.total, 3)
  const uf = await admin.get(`/api/super-admin/users?role=SUPER_ADMIN&limit=50`)
  t.ok('role filter returns only super admins', uf.body.data.every((u) => u.role === 'SUPER_ADMIN') && uf.body.data.some((u) => u.id === adminId), uf.body.data.map((u) => u.email))

  t.section('Users: role change')
  const victimC = await L.loginEmail(victim.email)
  const rc = await admin.patch(`/api/super-admin/users/${victim.id}/role`, { role: 'EVENT_MANAGER' })
  t.ok('change role USER -> EVENT_MANAGER (200)', rc.status === 200, rc.body)
  t.eq('DB reflects the role', (await p.user.findUnique({ where: { id: victim.id } })).role, 'EVENT_MANAGER')
  const ul = await admin.get(`/api/super-admin/users?search=${encodeURIComponent(victim.email)}`)
  t.eq('users list reflects the role', ul.body.data[0] && ul.body.data[0].role, 'EVENT_MANAGER')
  const sess = await victimC.session()
  if (sess && sess.role !== 'EVENT_MANAGER') t.note(`Role change reaches a signed-in user only at the next token refresh (up to 5 min): their session still says ${sess.role}. Verified by 07-session-refresh.cjs.`)
  t.ok('invalid role refused (400)', (await admin.patch(`/api/super-admin/users/${victim.id}/role`, { role: 'GOD' })).status === 400)
  const same = await admin.patch(`/api/super-admin/users/${victim.id}/role`, { role: 'EVENT_MANAGER' })
  t.ok('same role -> "Role unchanged"', same.status === 200 && /unchanged/i.test(same.body.message), same.body)
  const selfDemote = await admin.patch(`/api/super-admin/users/${adminId}/role`, { role: 'USER' })
  t.ok('super admin cannot demote themselves (400)', selfDemote.status === 400, selfDemote.body)
  t.eq('admin is still SUPER_ADMIN', (await p.user.findUnique({ where: { id: adminId } })).role, 'SUPER_ADMIN')
  const selfBan = await admin.patch(`/api/super-admin/users/${adminId}/ban`, { reason: 'x' })
  t.ok('super admin cannot ban themselves (400)', selfBan.status === 400, selfBan.body)
  t.eq('admin is not banned', (await p.user.findUnique({ where: { id: adminId } })).isBanned, false)
  const promote = await admin.patch(`/api/super-admin/users/${tempSa.id}/role`, { role: 'SUPER_ADMIN' })
  t.ok('promote a temp user to SUPER_ADMIN (200)', promote.status === 200)
  const banSa = await admin.patch(`/api/super-admin/users/${tempSa.id}/ban`, {})
  t.ok('another super admin cannot be banned (403)', banSa.status === 403, banSa.body)
  const demote = await admin.patch(`/api/super-admin/users/${tempSa.id}/role`, { role: 'USER' })
  t.ok('a super admin can demote another super admin (200)', demote.status === 200)
  if (demote.status === 200) t.note('Any super admin can demote any other super admin with one click (no confirmation step or second approver); only self-demotion is blocked.')
  const auditRole = await admin.get(`/api/super-admin/audit-logs?search=${encodeURIComponent(`E2E Victim ${run}`)}`)
  t.ok('audit log has the role change', (auditRole.body.data || []).some((a) => /role from/i.test(a.description)), (auditRole.body.data || []).map((a) => a.description))

  // ── Enterprise fixture (owner = the super admin, exactly as the UI creates it) ─
  t.section('Enterprises: create, list, verify, edit')
  const ce = await admin.post('/api/super-admin/enterprises', { name: ENT_NAME, slug: SLUG, email: `${SLUG}@test.local`, type: 'COMPANY', ownerEmail: 'admin@eventflow.com' })
  if (!t.ok('create enterprise as the UI does (owner email) 201', ce.status === 201, ce.body)) throw new Error('cannot continue')
  const ENT = ce.body.data.id
  const dupe = await admin.post('/api/super-admin/enterprises', { name: `${NAME_PREFIX} Dupe ${run}`, slug: SLUG, email: `${SLUG}@test.local`, ownerEmail: 'admin@eventflow.com' })
  t.ok('duplicate slug gives a clear 409 (not a 500)', dupe.status === 409, `${dupe.status} ${dupe.body && dupe.body.message}`)
  const badSlug = await admin.post('/api/super-admin/enterprises', { name: `${NAME_PREFIX} Bad ${run}`, slug: `Bad Slug ${run}!`, email: `${SLUG}@test.local`, ownerEmail: 'admin@eventflow.com' })
  t.ok('a slug with spaces/punctuation is refused (400)', badSlug.status === 400, `${badSlug.status} (stored slug: ${badSlug.body && badSlug.body.data && badSlug.body.data.slug})`)
  const badOwner = await admin.post('/api/super-admin/enterprises', { name: `${NAME_PREFIX} NoOwner ${run}`, slug: `${SLUG}-noowner`, email: `${SLUG}@test.local`, ownerEmail: 'no-such-user@test.local' })
  t.ok('an unknown owner email gives a 400/404 (not a 500)', [400, 404].includes(badOwner.status), badOwner.status)
  const inv = await admin.post('/api/members/invite', { email: entMember.email, role: 'ENTERPRISE_MANAGER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('add an e2e Enterprise Manager to it (201)', inv.status === 201, inv.body)
  const orgRes = await admin.post(`/api/admin/enterprise/${ENT}/organizations`, { name: `${NAME_PREFIX} SA Club ${run}`, slug: `${SLUG}-club`, category: 'TECHNICAL', email: `club@${SLUG}.example.edu` })
  t.ok('super admin creates an org inside it (201)', orgRes.status === 201)
  const ORG = orgRes.body.data.id
  const ev = await p.event.create({ data: { title: `${NAME_PREFIX} SA Event ${run}`, slug: `${SLUG}-event`, description: 'e2e', startDate: new Date(Date.now() + 864e5 * 40), endDate: new Date(Date.now() + 864e5 * 40 + 36e5), organizationId: ORG, enterpriseId: ENT, createdById: entMember.id, status: 'DRAFT' } })

  const el = await admin.get(`/api/super-admin/enterprises?search=${encodeURIComponent(run)}`)
  const row = el.body.data.find((e) => e.id === ENT)
  t.ok('new enterprise is listed with counts (1 org, 1 event, 2 members: owner + invited)', row && row._count.organizations === 1 && row._count.events === 1 && row._count.members === 2, row && row._count)
  if (row && row.owner) t.note(`Super admin "Create enterprise" has no owner field: the enterprise is owned by the operator (${row.owner.name}), who is not a member, so the university's own admin can never be owner (cannot delete it, no transfer-ownership action).`)
  const unv = await admin.get(`/api/super-admin/enterprises?status=unverified&search=${encodeURIComponent(run)}`)
  t.ok('Unverified filter includes it', unv.body.data.some((e) => e.id === ENT))
  const vr = await admin.patch(`/api/super-admin/enterprises/${ENT}/verify`)
  t.ok('verify (200, isVerified true)', vr.status === 200 && vr.body.data.isVerified === true, vr.body.data && vr.body.data.isVerified)
  const ver = await admin.get(`/api/super-admin/enterprises?status=verified&search=${encodeURIComponent(run)}`)
  t.ok('Verified filter includes it', ver.body.data.some((e) => e.id === ENT))
  const pubEnt = await anon.get(`/api/public/enterprises/${SLUG}`)
  t.ok('public enterprise profile shows verified', pubEnt.status === 200 && JSON.stringify(pubEnt.body).includes('"isVerified":true'), pubEnt.status)
  const det = await admin.get(`/api/super-admin/enterprises/${ENT}`)
  t.ok('enterprise detail loads with owner + counts', det.status === 200 && det.body.data.owner.id === adminId, det.body.data && det.body.data.owner)
  const ed = await admin.patch(`/api/super-admin/enterprises/${ENT}`, { website: 'https://e2e-sa.example.com', phone: '+91 80000 00000' })
  t.ok('edit enterprise profile (200)', ed.status === 200 && ed.body.data.website === 'https://e2e-sa.example.com', ed.body)
  t.ok('edit refuses a non-http website (400)', (await admin.patch(`/api/super-admin/enterprises/${ENT}`, { website: 'javascript:alert(1)' })).status === 400)

  t.section('Enterprises: deactivate / reactivate reflects on members')
  const emC = await L.loginEmail(entMember.email)
  t.ok('member has API access while active (200)', (await emC.get(`/api/admin/enterprise/${ENT}/events`)).status === 200)
  const pageBefore = await emC.get('/admin/enterprise')
  t.ok('member can open /admin/enterprise while active (200)', pageBefore.status === 200, `${pageBefore.status} ${pageBefore.location}`)
  const dashBefore = (await admin.get('/api/super-admin/dashboard-stats')).body.data.activeEnterprises
  const off = await admin.patch(`/api/super-admin/enterprises/${ENT}/status`, { isActive: false, confirm: ENT_NAME })
  t.ok('deactivate (200, isActive false)', off.status === 200 && off.body.data.isActive === false)
  t.ok('member loses API access when deactivated (403)', (await emC.get(`/api/admin/enterprise/${ENT}/events`)).status === 403)
  const pageOff = await emC.get('/admin/enterprise')
  t.ok('member is sent away from /admin/enterprise (redirect)', [302, 307].includes(pageOff.status), `${pageOff.status} ${pageOff.location}`)
  t.ok('public profile of a deactivated enterprise is gone (404)', (await anon.get(`/api/public/enterprises/${SLUG}`)).status === 404)
  const inact = await admin.get(`/api/super-admin/enterprises?status=inactive&search=${encodeURIComponent(run)}`)
  t.ok('Inactive filter includes it', inact.body.data.some((e) => e.id === ENT))
  t.eq('dashboard "active enterprises" drops by 1', (await admin.get('/api/super-admin/dashboard-stats')).body.data.activeEnterprises, dashBefore - 1)
  const on = await admin.patch(`/api/super-admin/enterprises/${ENT}/status`, { isActive: true })
  t.ok('reactivate (200, isActive true)', on.status === 200 && on.body.data.isActive === true)
  t.ok('member regains API access (200)', (await emC.get(`/api/admin/enterprise/${ENT}/events`)).status === 200)
  t.ok('member can open /admin/enterprise again (200)', (await emC.get('/admin/enterprise')).status === 200)
  const auditStatus = await admin.get(`/api/super-admin/audit-logs?search=${encodeURIComponent(ENT_NAME)}`)
  const descs = (auditStatus.body.data || []).map((a) => a.description)
  t.ok('audit has Created / Verified / Deactivated / Activated entries', ['Created enterprise', 'Verified enterprise', 'Deactivated enterprise', 'Activated enterprise'].every((s) => descs.some((d) => d && d.startsWith(s))), descs)

  // ── Ban / unban ────────────────────────────────────────────────────────────
  t.section('Users: ban / unban reflects')
  const victimInv = await admin.post('/api/members/invite', { email: victim.email, role: 'ENTERPRISE_MANAGER', entityType: 'ENTERPRISE', entityId: ENT })
  t.ok('victim made Enterprise Manager of the temp enterprise', victimInv.status === 201)
  const victimC2 = await L.loginEmail(victim.email)
  t.ok('victim (signed in) can use the enterprise API', (await victimC2.get(`/api/admin/enterprise/${ENT}/events`)).status === 200)
  const vOrg = await victimC2.post(`/api/admin/enterprise/${ENT}/organizations`, { name: `${NAME_PREFIX} Victim Club ${run}`, slug: `${SLUG}-vclub`, category: 'OTHER', email: `v@${SLUG}.example.edu` })
  t.ok('victim (Enterprise Manager) creates a club, so they have an audit trail (201)', vOrg.status === 201, vOrg.status)
  const kBefore = (await admin.get('/api/super-admin/users?limit=1')).body.stats
  const ban = await admin.patch(`/api/super-admin/users/${victim.id}/ban`, { reason: 'E2E test ban' })
  t.ok('ban with a reason (200, isBanned true)', ban.status === 200 && ban.body.data.isBanned === true, ban.body)
  const vdb = await p.user.findUnique({ where: { id: victim.id } })
  t.ok('DB: isBanned + banReason stored', vdb.isBanned && vdb.banReason === 'E2E test ban', vdb)
  const kAfter = (await admin.get('/api/super-admin/users?limit=1')).body.stats
  t.ok('KPIs: banned +1, active -1', kAfter.banned === kBefore.banned + 1 && kAfter.active === kBefore.active - 1, { kBefore, kAfter })
  const banned = await admin.get('/api/super-admin/users?status=banned&limit=100')
  t.ok('Banned filter lists the victim', banned.body.data.some((u) => u.id === victim.id))
  const relog = await new L.Client('victim-relog').login(victim.email, L.E2E_PASSWORD)
  t.ok('banned user cannot sign in (code ACCOUNT_BANNED)', !relog.ok && /BANNED/i.test(relog.code + relog.location), relog)
  const stillApi = await victimC2.get(`/api/admin/enterprise/${ENT}/events`)
  t.ok('a banned admin\'s existing session is refused by admin APIs at once', stillApi.status !== 200,
    `GET enterprise events with the pre-ban session -> ${stillApi.status}. authorize()/getContextRole() check isActive but not isBanned, so the ban only bites at the next 5-min token refresh`)
  const unban = await admin.patch(`/api/super-admin/users/${victim.id}/ban`, {})
  t.ok('unban (200, isBanned false, reason cleared)', unban.status === 200 && unban.body.data.isBanned === false)
  t.eq('DB: banReason cleared', (await p.user.findUnique({ where: { id: victim.id } })).banReason, null)
  const relog2 = await new L.Client('victim-relog2').login(victim.email, L.E2E_PASSWORD)
  t.ok('unbanned user can sign in again', relog2.ok, relog2)
  const kBack = (await admin.get('/api/super-admin/users?limit=1')).body.stats
  t.ok('KPIs back to the pre-ban numbers', kBack.banned === kBefore.banned && kBack.active === kBefore.active, { kBefore, kBack })
  const auditBan = await admin.get(`/api/super-admin/audit-logs?search=${encodeURIComponent(`E2E Victim ${run}`)}`)
  const banDescs = (auditBan.body.data || []).map((a) => a.description)
  t.ok('audit has Banned (with reason) and Unbanned entries', banDescs.some((d) => /^Banned user: .*E2E test ban/.test(d)) && banDescs.some((d) => /^Unbanned user/.test(d)), banDescs)

  // ── Events / subscriptions / messages / dashboard ───────────────────────────
  t.section('Events totals')
  const ACTIVE = ['PUBLISHED', 'REGISTRATION_OPEN', 'ONGOING']
  const evs = await admin.get('/api/super-admin/events?limit=1')
  const dbEv = {
    total: await p.event.count({ where: { deletedAt: null } }),
    active: await p.event.count({ where: { deletedAt: null, status: { in: ACTIVE } } }),
    completed: await p.event.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
  }
  t.eq('events KPIs (total/active/completed) equal the DB', evs.body.stats, dbEv)
  const evSearch = await admin.get(`/api/super-admin/events?search=${encodeURIComponent(`SA Event ${run}`)}`)
  t.ok('event search finds the temp event with org + enterprise names', evSearch.body.data.length === 1 && evSearch.body.data[0].enterprise === ENT_NAME, evSearch.body.data)
  const dash = (await admin.get('/api/super-admin/dashboard-stats')).body.data
  const dbDash = {
    totalUsers: await p.user.count({ where: { deletedAt: null } }),
    totalEvents: dbEv.total,
    activeEnterprises: await p.enterprise.count({ where: { isActive: true, deletedAt: null } }),
  }
  t.eq('super-admin dashboard KPIs equal the DB', { totalUsers: dash.totalUsers, totalEvents: dash.totalEvents, activeEnterprises: dash.activeEnterprises }, dbDash)
  const orgsList = await admin.get(`/api/super-admin/organizations?search=${encodeURIComponent(`SA Club ${run}`)}`)
  t.ok('super-admin organizations list shows the club with its enterprise', orgsList.body.data.length === 1 && orgsList.body.data[0].enterprise === ENT_NAME, orgsList.body.data)

  t.section('Subscriptions')
  const subs = await admin.get('/api/super-admin/subscriptions')
  const dbPlans = {}
  for (const pl of ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']) dbPlans[pl] = await p.subscription.count({ where: { plan: pl } })
  t.eq('plan counts equal the DB', subs.body.data.planCounts, dbPlans)

  t.section('Messages')
  const msg = await p.contactMessage.create({ data: { name: `${NAME_PREFIX} Visitor ${run}`, email: `${PREFIX}visitor-${run}@test.local`, subject: `${NAME_PREFIX} question ${run}`, message: 'Can our university use EventFlow for 40 clubs?' } })
  const m1 = await admin.get('/api/super-admin/contact-messages?limit=100')
  t.ok('new message is listed', m1.body.data.some((m) => m.id === msg.id))
  t.eq('unread count equals the DB', m1.body.unreadCount, await p.contactMessage.count({ where: { status: 'NEW' } }))
  const mr = await admin.patch('/api/super-admin/contact-messages', { id: msg.id, status: 'READ' })
  t.ok('mark as read (200)', mr.status === 200)
  const m2 = await admin.get('/api/super-admin/contact-messages?limit=100')
  t.ok('unread count drops by 1 and the row says READ', m2.body.unreadCount === m1.body.unreadCount - 1 && m2.body.data.find((m) => m.id === msg.id).status === 'READ', { before: m1.body.unreadCount, after: m2.body.unreadCount })
  const mBad = await admin.patch('/api/super-admin/contact-messages', { id: msg.id, status: 'BOGUS' })
  t.ok('an unknown message status is refused (400)', mBad.status === 400, `${mBad.status}; stored: ${(await p.contactMessage.findUnique({ where: { id: msg.id } })).status}`)
  const mMissing = await admin.patch('/api/super-admin/contact-messages', { id: 'no-such-id', status: 'READ' })
  t.ok('a missing message id gives 404 (not 500)', mMissing.status === 404, mMissing.status)

  t.section('Audit log')
  const aBad = await admin.get('/api/super-admin/audit-logs?action=NOT_AN_ACTION')
  t.ok('an unknown action filter does not 500', aBad.status !== 500, aBad.status)
  const aUser = await admin.get(`/api/super-admin/audit-logs?search=${encodeURIComponent(victim.email)}`)
  t.ok('audit search by the actor\'s email finds what they did', (aUser.body.data || []).some((a) => a.user && a.user.id === victim.id), 'search only looks at description/entityId, not the user who acted')

  // ── Delete with typed confirmation ─────────────────────────────────────────
  t.section('Enterprises: delete (typed confirmation, soft)')
  const noConf = await admin.del(`/api/super-admin/enterprises/${ENT}`, {})
  t.ok('delete without confirmation refused (400)', noConf.status === 400)
  const wrong = await admin.del(`/api/super-admin/enterprises/${ENT}`, { confirm: 'Demo University' })
  t.ok('delete with another name refused (400)', wrong.status === 400, wrong.body)
  const del = await admin.del(`/api/super-admin/enterprises/${ENT}`, { confirm: `  ${ENT_NAME.toUpperCase()} ` })
  t.ok('delete with the name typed (case/space-insensitive) 200', del.status === 200, del.body)
  const edb = await p.enterprise.findUnique({ where: { id: ENT } })
  t.ok('soft delete: deletedAt set, inactive, row kept', !!edb.deletedAt && !edb.isActive, edb && { deletedAt: edb.deletedAt, isActive: edb.isActive })
  t.ok('deleted enterprise leaves the list', !(await admin.get(`/api/super-admin/enterprises?search=${encodeURIComponent(run)}`)).body.data.some((e) => e.id === ENT))
  t.ok('detail now 404', (await admin.get(`/api/super-admin/enterprises/${ENT}`)).status === 404)
  t.ok('audit has "Deleted enterprise … (super-admin)"', (await p.auditLog.count({ where: { enterpriseId: ENT, action: 'DELETE', description: { contains: '(super-admin)' } } })) === 1)
  t.ok('member loses access after delete (403)', (await emC.get(`/api/admin/enterprise/${ENT}/events`)).status === 403)
  const again = await admin.del(`/api/super-admin/enterprises/${ENT}`, { confirm: ENT_NAME })
  t.ok('deleting twice gives 404', again.status === 404)
  const reuse = await admin.post('/api/super-admin/enterprises', { name: `${NAME_PREFIX} Reuse ${run}`, slug: SLUG, email: `${SLUG}@test.local`, ownerEmail: 'admin@eventflow.com' })
  if (reuse.status !== 201) t.note(`A soft-deleted enterprise keeps its slug forever: re-creating "${SLUG}" fails with ${reuse.status} (no restore action in the UI either).`)
  void ev
}

main()
  .catch((e) => t.ok('script aborted', false, e && (e.stack || e.message)))
  .finally(async () => {
    if (process.env.E2E_KEEP !== '1') await L.cleanupAll().catch((e) => console.error('cleanup failed', e))
    const fails = t.save()
    await db().$disconnect()
    process.exit(fails ? 1 : 0)
  })
