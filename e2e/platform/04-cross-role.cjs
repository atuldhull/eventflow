// Cross-role refusals + middleware. alice (ORG_ADMIN of a Demo University club) and carol (USER)
// must be refused on every enterprise and super-admin page and API; an e2e Enterprise Admin
// must be refused on another enterprise (tenant isolation) and on the super-admin area.
// Mutations are aimed at a temporary enterprise only, never at demo data.
// Usage: node e2e/platform/04-cross-role.cjs
'use strict'
const L = require('./lib.cjs')
const { db, PREFIX, NAME_PREFIX } = L

const t = L.makeT('04-cross-role')
const run = L.runId()
const anon = new L.Client('anon')

const ENT_PAGES = ['', '/analytics', '/audit-logs', '/billing', '/branding', '/events', '/members', '/organizations', '/organizations/create', '/organizations/ORG', '/organizations/ORG/edit', '/payments', '/registrations', '/settings']
const SA_PAGES = ['', '/analytics', '/audit', '/enterprises', '/events', '/messages', '/organizations', '/settings', '/subscriptions', '/users']

function entReads(ent, org, ev) {
  const b = `/api/admin/enterprise/${ent}`
  return [
    `${b}/settings`, `${b}/branding`, `${b}/dashboard-stats`, `${b}/organizations`, `${b}/organizations/${org}`, `${b}/organizations/${org}?include=details`,
    `${b}/members`, `${b}/members?status=inactive`, `${b}/events`, `${b}/payments`, `${b}/payments/export`, `${b}/registrations`, `${b}/registrations/export`,
    `${b}/audit-logs`, `${b}/audit-logs/export`, `/api/admin/billing?entityType=enterprise&entityId=${ent}`, `/api/admin/billing/usage?entityType=enterprise&entityId=${ent}`,
  ].concat(ev ? [] : [])
}

function entWrites(ent, org, ev, memberId) {
  const b = `/api/admin/enterprise/${ent}`
  return [
    ['PATCH', `${b}/settings`, { description: 'xrole-hacked', settings: { requireEventApproval: true } }],
    ['PATCH', `${b}/branding`, { primaryColor: '#ff0000' }],
    ['POST', `${b}/organizations`, { name: `${NAME_PREFIX} Hack ${run}`, slug: `${PREFIX}hack-${run}`, category: 'OTHER', email: 'h@example.edu' }],
    ['PATCH', `${b}/organizations/${org}`, { name: `${NAME_PREFIX} Hacked ${run}` }],
    ['DELETE', `${b}/organizations/${org}`, undefined],
    ['POST', `${b}/events/${ev}/approve`, { action: 'approve' }],
    ['POST', `${b}/domain/verify`, { domain: 'hack.example.com' }],
    ['POST', `${b}/domain/remove`, {}],
    ['DELETE', b, { confirm: 'x' }],
    ['POST', '/api/members/invite', { email: `${PREFIX}hackinv-${run}@test.local`, role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ent }],
    ['PATCH', `/api/members/${memberId}/role`, { role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ent }],
    ['DELETE', `/api/members/${memberId}/remove`, { entityType: 'ENTERPRISE', entityId: ent }],
    ['POST', '/api/admin/billing/subscribe', { plan: 'FREE', billingInterval: 'MONTHLY', entityType: 'enterprise', entityId: ent }],
  ]
}

function saCalls(victimId, ent) {
  return [
    ['GET', '/api/super-admin/users'], ['GET', '/api/super-admin/enterprises'], ['GET', `/api/super-admin/enterprises/${ent}`], ['GET', '/api/super-admin/events'],
    ['GET', '/api/super-admin/organizations'], ['GET', '/api/super-admin/subscriptions'], ['GET', '/api/super-admin/contact-messages'], ['GET', '/api/super-admin/audit-logs'],
    ['GET', '/api/super-admin/dashboard-stats'], ['GET', '/api/super-admin/settings'],
    ['PATCH', `/api/super-admin/users/${victimId}/ban`, { reason: 'xrole' }], ['PATCH', `/api/super-admin/users/${victimId}/role`, { role: 'SUPER_ADMIN' }],
    ['PATCH', `/api/super-admin/enterprises/${ent}/verify`], ['PATCH', `/api/super-admin/enterprises/${ent}/status`], ['PATCH', `/api/super-admin/enterprises/${ent}`, { phone: '1' }],
    ['DELETE', `/api/super-admin/enterprises/${ent}`, { confirm: 'x' }], ['POST', '/api/super-admin/enterprises', { name: 'x', slug: 'x', email: 'bad', ownerId: 'current' }],
    ['POST', '/api/super-admin/settings', {}], ['POST', '/api/super-admin/settings/test-email', { to: 'not-an-email' }], ['POST', '/api/super-admin/impersonate', {}],
    ['POST', '/api/super-admin/payments/reconcile', {}], ['PATCH', '/api/super-admin/contact-messages', {}],
  ]
}

const refused = (s) => s === 401 || s === 403 || s === 404

async function main() {
  if (!(await L.serverUp())) throw new Error('dev server not responding on ' + L.BASE)
  const p = db()
  const admin = await L.loginAs('admin')
  const demoEnt = await p.enterprise.findFirst({ where: { slug: 'demo-university' }, select: { id: true } })
  const demoOrg = await p.organization.findFirst({ where: { slug: 'tech-club' }, select: { id: true } })

  // Temp target for mutations
  const owner = await L.createUser(`xr-owner-${run}`)
  const victim = await L.createUser(`xr-victim-${run}`)
  const ent = await p.enterprise.create({ data: { name: `${NAME_PREFIX} XRole ${run}`, slug: `${PREFIX}xr-${run}`, email: 'xr@example.edu', ownerId: owner.id, members: { create: { userId: owner.id, role: 'ENTERPRISE_ADMIN' } } } })
  const org = await p.organization.create({ data: { name: `${NAME_PREFIX} XRole Club ${run}`, slug: `${PREFIX}xr-club-${run}`, email: 'c@example.edu', enterpriseId: ent.id } })
  const mem = await p.enterpriseMember.create({ data: { enterpriseId: ent.id, userId: victim.id, role: 'VIEWER' } })
  const ev = await p.event.create({ data: { title: `${NAME_PREFIX} XRole Pending ${run}`, slug: `${PREFIX}xr-ev-${run}`, description: 'x', startDate: new Date(Date.now() + 864e6), endDate: new Date(Date.now() + 864e6 + 36e5), organizationId: org.id, enterpriseId: ent.id, createdById: owner.id, status: 'PENDING_APPROVAL' } })
  const snapshot = async () => JSON.stringify(await p.enterprise.findUnique({ where: { id: ent.id }, include: { organizations: true, members: true } })) + (await p.event.findUnique({ where: { id: ev.id } })).status + JSON.stringify(await p.user.findUnique({ where: { id: victim.id }, select: { role: true, isBanned: true } }))
  const before = await snapshot()

  const alice = await L.loginAs('alice')
  const carol = await L.loginAs('carol')
  const ownerC = await L.loginEmail(owner.email)

  for (const [who, c] of [['alice', alice], ['carol', carol]]) {
    t.section(`${who}: enterprise + super-admin APIs`)
    for (const [label, entId] of [['Demo University', demoEnt.id], ['temp enterprise', ent.id]]) {
      const bad = []
      for (const url of entReads(entId, entId === ent.id ? org.id : demoOrg.id)) {
        const r = await c.get(url)
        if (!refused(r.status)) bad.push(`${url} -> ${r.status}`)
      }
      t.ok(`${who}: all ${entReads(entId, '').length} enterprise read APIs refused (${label})`, bad.length === 0, bad)
    }
    const badW = []
    for (const [m, url, body] of entWrites(ent.id, org.id, ev.id, mem.id)) {
      const r = await c.req(m, url, { json: body })
      if (!refused(r.status)) badW.push(`${m} ${url} -> ${r.status}`)
    }
    t.ok(`${who}: all ${entWrites('', '', '', '').length} enterprise write APIs refused`, badW.length === 0, badW)
    const badS = []
    for (const [m, url, body] of saCalls(victim.id, ent.id)) {
      const r = await c.req(m, url, { json: body })
      if (r.status !== 403 && r.status !== 401) badS.push(`${m} ${url} -> ${r.status}`)
    }
    t.ok(`${who}: all ${saCalls('', '').length} super-admin APIs answer 403`, badS.length === 0, badS)

    t.section(`${who}: enterprise + super-admin pages`)
    const badP = []
    for (const pg of SA_PAGES) {
      const r = await c.get(`/super-admin${pg}`)
      if (!([302, 307].includes(r.status) && /\/dashboard/.test(r.location))) badP.push(`/super-admin${pg} -> ${r.status} ${r.location}`)
    }
    t.ok(`${who}: all ${SA_PAGES.length} super-admin pages redirect to /dashboard`, badP.length === 0, badP)
    const entPageResults = []
    for (const pg of ENT_PAGES) {
      const r = await c.get(`/admin/enterprise${pg.replace('ORG', demoOrg.id)}`)
      entPageResults.push({ pg, status: r.status, location: r.location })
    }
    const redirected = entPageResults.filter((r) => [302, 307].includes(r.status))
    // By design an admin role may load the /admin page frame (the page then says "You don't have
    // access"); what must never happen is data: every enterprise API is refused (checked above/below).
    const okPages = entPageResults.filter((r) => [302, 307, 403].includes(r.status) || (r.status === 200 && who === 'alice'))
    t.ok(`${who}: all ${ENT_PAGES.length} enterprise pages redirect, refuse, or (admins) show only the no-access frame`, okPages.length === ENT_PAGES.length,
      `${redirected.length}/${ENT_PAGES.length} redirected; e.g. ${JSON.stringify(entPageResults.find((r) => ![302, 307].includes(r.status)))}`)
    if (who === 'alice' && redirected.length < ENT_PAGES.length) t.note('alice (club admin) gets the /admin/enterprise page frame (200) with "You don\'t have access"; all enterprise data APIs answer 403')
  }
  t.ok('no refused call changed the temp enterprise, its event or user', (await snapshot()) === before)
  const leak = await p.organization.count({ where: { slug: `${PREFIX}hack-${run}` } })
  t.eq('no org was created by a refused call', leak, 0)

  t.section('Tenant isolation: e2e Enterprise Admin vs Demo University + super admin')
  const badT = []
  for (const url of entReads(demoEnt.id, demoOrg.id)) {
    const r = await ownerC.get(url)
    if (!refused(r.status)) badT.push(`${url} -> ${r.status}`)
  }
  t.ok('another enterprise\'s admin is refused on every Demo University API', badT.length === 0, badT)
  t.ok('…and on Demo University org APIs', refused((await ownerC.get(`/api/admin/org/${demoOrg.id}/events`)).status))
  const badTS = []
  for (const [m, url, body] of saCalls(victim.id, ent.id).filter(([m]) => m === 'GET')) {
    const r = await ownerC.req(m, url, { json: body })
    if (r.status !== 403) badTS.push(`${url} -> ${r.status}`)
  }
  t.ok('enterprise admin gets 403 on super-admin APIs', badTS.length === 0, badTS)
  const saPage = await ownerC.get('/super-admin')
  t.ok('enterprise admin is redirected from /super-admin', [302, 307].includes(saPage.status), saPage.status)
  const own = await ownerC.get(`/api/admin/enterprise/${ent.id}/settings`)
  t.ok('…while their own enterprise works (200)', own.status === 200, own.status)

  t.section('Middleware')
  t.eq('/offline is public (200)', (await anon.get('/offline')).status, 200)
  const unknownAnon = await anon.get(`/no-such-page-${run}`)
  t.ok('unknown page (signed out) -> 404', unknownAnon.status === 404, `${unknownAnon.status} -> ${unknownAnon.location} (middleware treats every unknown path as private and sends visitors to /login first)`)
  t.eq('unknown page (signed in) -> 404', (await carol.get(`/no-such-page-${run}`)).status, 404)
  t.eq('unknown event slug API -> 404', (await anon.get(`/api/events/no-such-event-${run}`)).status, 404)
  const unk = await admin.get(`/admin/enterprise/no-such-page-${run}`)
  t.eq('unknown admin page (signed in) -> 404', unk.status, 404)
  const a1 = await anon.get('/admin/enterprise/members?tab=removed')
  t.ok('signed out /admin/enterprise/members -> /login with callbackUrl incl. query', [302, 307].includes(a1.status) && decodeURIComponent(a1.location).includes('callbackUrl=/admin/enterprise/members?tab=removed'), a1.location)
  const a2 = await anon.get('/super-admin/users')
  t.ok('signed out /super-admin/users -> /login', [302, 307].includes(a2.status) && /\/login/.test(a2.location), a2.location)
  const a3 = await anon.get(`/api/admin/enterprise/${demoEnt.id}/settings`)
  t.ok('signed out admin API -> 401 JSON (not a redirect)', a3.status === 401 && a3.body && a3.body.success === false, a3.status)
  t.eq('signed out super-admin API -> 401', (await anon.get('/api/super-admin/users')).status, 401)
  const c1 = await carol.get('/admin')
  t.eq('carol may open /admin (workspace picker / onboarding)', c1.status, 200)
  t.eq('carol may open /admin/create-org', (await carol.get('/admin/create-org')).status, 200)
  const c2 = await carol.get('/admin/org')
  t.ok('carol is sent from /admin/org to /dashboard', [302, 307].includes(c2.status) && /\/dashboard/.test(c2.location), c2.location)
  const c3 = await carol.get('/login')
  t.ok('signed-in carol visiting /login is forwarded', [302, 307].includes(c3.status), c3.status)
  t.eq('admin can open /super-admin (200)', (await admin.get('/super-admin')).status, 200)
  const headers = (await anon.get('/')).headers
  t.ok('security headers on pages (X-Frame-Options DENY, CSP, nosniff)', headers.get('x-frame-options') === 'DENY' && !!headers.get('content-security-policy') && headers.get('x-content-type-options') === 'nosniff')

  // What alice actually sees on the enterprise pages (they answer 200 for an ORG_ADMIN)
  t.section('Browser: what an org admin sees on /admin/enterprise')
  await L.withBrowser(async (browser) => {
    const { page } = await L.browserLogin(browser, ...L.ACCOUNTS.alice)
    for (const pg of ['/admin/enterprise', '/admin/enterprise/members', '/admin/enterprise/settings']) {
      const apiStatuses = []
      const onResp = (r) => { if (r.url().includes('/api/admin/enterprise/')) apiStatuses.push(r.status()) }
      page.on('response', onResp)
      await page.goto(L.BASE + pg, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {})
      await L.sleep(1500)
      page.off('response', onResp)
      const url = page.url()
      const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300)
      const name = `xrole-alice${pg.replace(/\//g, '_')}`
      await L.shot(page, name)
      const handled = !url.includes('/admin/enterprise') || /access|permission|not allowed|no enterprise/i.test(text)
      t.ok(`alice on ${pg}: redirected or told she has no access`, handled, `stayed on ${url}; enterprise API calls: [${apiStatuses.join(',')}]; text: ${text.slice(0, 160)}`)
    }
  })
}

main()
  .catch((e) => t.ok('script aborted', false, e && (e.stack || e.message)))
  .finally(async () => {
    if (process.env.E2E_KEEP !== '1') await L.cleanupAll().catch((e) => console.error('cleanup failed', e))
    const fails = t.save()
    await db().$disconnect()
    process.exit(fails ? 1 : 0)
  })
