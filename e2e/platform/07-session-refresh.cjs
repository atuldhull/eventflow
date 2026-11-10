// Ban / role change reaching a session that is ALREADY signed in. The JWT is re-checked
// against the DB every 5 minutes (src/lib/auth.ts jwt callback), so this script waits
// 5 min 20 s. API-only, no browser; cleans up only its own user.
// Usage: node e2e/platform/07-session-refresh.cjs
'use strict'
const L = require('./lib.cjs')
const { db } = L

const t = L.makeT('07-session-refresh')
const run = L.runId()
const WAIT_MS = Number(process.env.E2E_REFRESH_WAIT_MS || 320000)
const ids = []

async function main() {
  if (!(await L.serverUp())) throw new Error('dev server not responding on ' + L.BASE)
  const p = db()
  const admin = await L.loginAs('admin')
  const banned = await L.createUser(`sr-ban-${run}`, { name: `E2E Session Ban ${run}` })
  const promoted = await L.createUser(`sr-role-${run}`, { name: `E2E Session Role ${run}` })
  ids.push(banned.id, promoted.id)

  const bannedC = await L.loginEmail(banned.email)
  const promotedC = await L.loginEmail(promoted.email)
  t.ok('both users signed in', !!(await bannedC.session()) && !!(await promotedC.session()))

  t.section('Change, then check at once')
  const b = await admin.patch(`/api/super-admin/users/${banned.id}/ban`, { reason: 'E2E session refresh' })
  t.ok('ban (200)', b.status === 200)
  const r = await admin.patch(`/api/super-admin/users/${promoted.id}/role`, { role: 'ORG_ADMIN' })
  t.ok('role USER -> ORG_ADMIN (200)', r.status === 200)
  const s0 = await bannedC.session()
  console.log(`   right after the ban the old session is ${s0 ? 'still valid' : 'gone'}`)
  const r0 = await promotedC.session()
  console.log(`   right after the role change the session role is ${r0 && r0.role}`)
  const page0 = await promotedC.get('/admin/org')
  console.log(`   /admin/org for the promoted user right away: ${page0.status} ${page0.location}`)

  t.section(`Wait ${Math.round(WAIT_MS / 1000)} s for the token refresh window`)
  await L.sleep(WAIT_MS)
  if (!(await L.serverUp())) throw new Error('dev server stopped responding during the wait')

  const s1 = await bannedC.session()
  t.ok('banned user\'s existing session has ended', !s1, s1)
  const api1 = await bannedC.get('/api/notifications')
  t.ok('banned user\'s API calls now get 401', api1.status === 401, api1.status)
  const page1 = await bannedC.get('/dashboard')
  t.ok('banned user is sent to /login', [302, 307].includes(page1.status) && /\/login/.test(page1.location), `${page1.status} ${page1.location}`)
  const r1 = await promotedC.session()
  t.eq('promoted user\'s session now carries the new role', r1 && r1.role, 'ORG_ADMIN')

  t.section('Unban restores')
  const u = await admin.patch(`/api/super-admin/users/${banned.id}/ban`, {})
  t.ok('unban (200)', u.status === 200 && u.body.data.isBanned === false, { status: u.status, body: u.body, adminSession: await admin.session() })
  const dbU = await db().user.findUnique({ where: { id: banned.id }, select: { isBanned: true } })
  console.log(`   DB after unban: isBanned=${dbU && dbU.isBanned}`)
  const again = await new L.Client('relogin').login(banned.email, L.E2E_PASSWORD)
  t.ok('unbanned user can sign in again', again.ok, again)
}

main()
  .catch((e) => t.ok('script aborted', false, e && (e.stack || e.message)))
  .finally(async () => {
    const p = db()
    await p.auditLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { userId: { in: ids } }] } }).catch(() => {})
    await p.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    const fails = t.save()
    await p.$disconnect()
    process.exit(fails ? 1 : 0)
  })
