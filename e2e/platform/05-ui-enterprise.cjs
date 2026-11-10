// Enterprise admin UI walkthrough in a real (headless) browser, as a university events-office
// admin whose global role is USER and who was added as Enterprise Admin (the normal case).
// Desktop 1440 + phone 390. ONE browser, closed at the end. Screenshots: out/shots/ui-ent-*.png
// Usage: node e2e/platform/05-ui-enterprise.cjs
'use strict'
const fs = require('fs')
const path = require('path')
const L = require('./lib.cjs')
const { db, PREFIX, NAME_PREFIX } = L

const t = L.makeT('05-ui-enterprise')
const run = L.runId()
const SLUG = `${PREFIX}ui-${run}`
const ENT_NAME = `${NAME_PREFIX} UI University ${run}`

async function selectOption(page, triggerSel, optionText) {
  await page.click(triggerSel)
  await page.waitForSelector('[role="option"]', { timeout: 8000 })
  // Base UI options react to real pointer events, not element.click()
  for (const h of await page.$$('[role="option"]')) {
    if ((await h.evaluate((e) => e.innerText)).toLowerCase().includes(optionText.toLowerCase())) { await h.click(); await L.sleep(300); return true }
  }
  return false
}

const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((e) => e.innerText).join(' | '))

async function waitToast(page, re, timeout = 12000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const txt = await toastText(page)
    if (re.test(txt)) return txt
    await L.sleep(300)
  }
  return await toastText(page)
}

async function go(page, p) {
  await page.goto(L.BASE + p, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  await L.sleep(800)
}

async function main() {
  if (!(await L.serverUp())) throw new Error('dev server not responding on ' + L.BASE)
  const p = db()

  // ── Fixtures through the API, as the real actors would do it ────────────────
  const owner = await L.createUser(`ui-owner-${run}`, { name: `UI Owner ${run}` })
  const club = await L.createUser(`ui-club-${run}`, { name: `UI Club Admin ${run}` })
  const viewer = await L.createUser(`ui-viewer-${run}`, { name: `UI Viewer ${run}` })
  const invitee = await L.createUser(`ui-invitee-${run}`, { name: `UI Invitee ${run}` })
  const att = await L.createUser(`ui-att-${run}`, { name: `UI Attendee ${run}` })
  const admin = await L.loginAs('admin')
  const ce = await admin.post('/api/super-admin/enterprises', { name: ENT_NAME, slug: SLUG, email: `${SLUG}@test.local`, type: 'UNIVERSITY', ownerEmail: owner.email })
  const ENT = ce.body.data.id
  await admin.post('/api/members/invite', { email: owner.email, role: 'ENTERPRISE_ADMIN', entityType: 'ENTERPRISE', entityId: ENT })
  const ownerC = await L.loginEmail(owner.email)
  const api = (s) => `/api/admin/enterprise/${ENT}${s}`
  const orgA = (await ownerC.post(api('/organizations'), { name: `${NAME_PREFIX} UI Club A ${run}`, slug: `${SLUG}-a`, category: 'TECHNICAL', email: `a@${SLUG}.example.edu` })).body.data
  await ownerC.post('/api/members/invite', { email: club.email, role: 'ORG_ADMIN', entityType: 'ORGANIZATION', entityId: orgA.id })
  await ownerC.post('/api/members/invite', { email: viewer.email, role: 'VIEWER', entityType: 'ENTERPRISE', entityId: ENT })
  await ownerC.patch(api('/settings'), { settings: { requireEventApproval: true } })
  const clubC = await L.loginEmail(club.email)
  const pending = (await clubC.post(`/api/admin/org/${orgA.id}/events`, L.eventBody(`${SLUG}-pending`, `${NAME_PREFIX} UI Pending ${run}`, { status: 'PUBLISHED' }))).body.data
  // 12 published events, so the Events page has more than one page of rows
  for (let i = 0; i < 12; i++) {
    await p.event.create({ data: { title: `${NAME_PREFIX} UI Published ${i} ${run}`, slug: `${SLUG}-pub-${i}`, description: 'x', startDate: new Date(Date.now() + 864e5 * (20 + i)), endDate: new Date(Date.now() + 864e5 * (20 + i) + 36e5), organizationId: orgA.id, enterpriseId: ENT, createdById: club.id, status: 'PUBLISHED', publishedAt: new Date() } })
  }
  const pubEv = await p.event.findFirst({ where: { slug: `${SLUG}-pub-0` }, include: { ticketTypes: true } })
  const tt = await p.ticketType.create({ data: { eventId: pubEv.id, name: 'Paid', price: 250 } })
  const reg = await p.registration.create({ data: { registrationNumber: `E2E-${run}-UI1`, eventId: pubEv.id, userId: att.id, ticketTypeId: tt.id, status: 'CONFIRMED' } })
  await p.payment.create({ data: { paymentNumber: `E2E-${run}-UIP1`, registrationId: reg.id, userId: att.id, eventId: pubEv.id, amount: 250, status: 'COMPLETED', method: 'RAZORPAY' } })
  const pngPath = path.join(L.OUT, `logo-${run}.png`)
  fs.writeFileSync(pngPath, L.PNG_1x1)

  await L.withBrowser(async (browser) => {
    const { page } = await L.browserLogin(browser, owner.email, L.E2E_PASSWORD)
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {})
    const exportHits = []
    page.on('response', (r) => { if (/\/export(\?|$)/.test(r.url())) exportHits.push({ url: r.url(), status: r.status(), ct: r.headers()['content-type'] || '' }) })

    // 1. Landing + hub numbers
    t.section('Hub (1440)')
    await go(page, '/admin')
    await page.waitForFunction(() => location.pathname === '/admin/enterprise', { timeout: 20000 }).catch(() => {})
    t.ok('/admin lands a single-enterprise admin on /admin/enterprise', page.url().endsWith('/admin/enterprise'), page.url())
    await L.waitText(page, /Organizations\s*\n?\s*\d/, 15000)
    await L.sleep(1500)
    await L.shot(page, 'ui-ent-hub-1440')
    const hubText = await page.evaluate(() => document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText)
    const kpi = (label) => { const m = hubText.match(new RegExp(`${label}\\s*\\n\\s*([₹\\d,.]+)`)); return m ? m[1].replace(/[₹,]/g, '') : null }
    const dash = (await ownerC.get(api('/dashboard-stats'))).body.data
    t.eq('hub KPIs (orgs/events/registrations) match the API', [kpi('Organizations'), kpi('Events'), kpi('Registrations')].map(Number), [dash.orgCount, dash.eventCount, dash.registrationCount])
    t.ok('hub revenue shows ₹250', /₹\s?250/.test(hubText), hubText.slice(0, 300))
    t.ok('hub lists the club', hubText.includes(`UI Club A ${run}`))
    const pendingVisible = /pending|approval/i.test(hubText)
    t.ok('hub tells the admin an event is waiting for approval', pendingVisible, 'no pending-approval count/queue on the hub; the only signal is a bell notification')

    // 2. Create an org through the form
    t.section('Create organization (form)')
    await go(page, '/admin/enterprise/organizations/create')
    await page.waitForSelector('#name')
    await page.type('#name', `${NAME_PREFIX} UI Club B ${run}`)
    const autoSlug = await page.$eval('#slug', (e) => e.value)
    t.ok('slug is generated from the name', /ui-club-b/.test(autoSlug), autoSlug)
    await page.$eval('#slug', (e) => { e.focus() })
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control')
    await page.type('#slug', `${SLUG}-b`)
    t.ok('category picker works', await selectOption(page, '#category', 'Cultural'))
    await page.type('#email', `b@${SLUG}.example.edu`)
    await L.clickText(page, 'button[type="submit"]', 'Create')
    const created = await waitToast(page, /created|fail|wrong/i)
    await page.waitForFunction(() => location.pathname === '/admin/enterprise/organizations', { timeout: 15000 }).catch(() => {})
    t.ok('create shows a success toast and returns to the list', /created/i.test(created) && page.url().endsWith('/admin/enterprise/organizations'), { toast: created, url: page.url() })
    await L.waitText(page, `UI Club B ${run}`, 10000)
    t.ok('new club is in the list', (await page.evaluate(() => document.body.innerText)).includes(`UI Club B ${run}`))
    const orgB = await p.organization.findFirst({ where: { slug: `${SLUG}-b` } })
    t.ok('DB: club B created in this enterprise', orgB && orgB.enterpriseId === ENT)
    await L.shot(page, 'ui-ent-orgs-1440')

    // 3. Edit with logo upload
    t.section('Edit organization + logo upload (form)')
    if (orgB) {
      await go(page, `/admin/enterprise/organizations/${orgB.id}/edit`)
      const input = await page.waitForSelector('input[type="file"]', { timeout: 15000 }).catch(() => null)
      t.ok('logo drop zone has a file input', !!input)
      if (input) {
        await input.uploadFile(pngPath)
        const uploaded = await page.waitForFunction(() => [...document.querySelectorAll('img')].some((i) => /\/uploads\//.test(i.src)), { timeout: 15000 }).then(() => true).catch(() => false)
        t.ok('logo preview appears after upload', uploaded)
        const src = await page.evaluate(() => ([...document.querySelectorAll('img')].find((i) => /\/uploads\//.test(i.src)) || {}).src || '')
        if (src) L.registry.add('uploads', src.split('/uploads/')[1])
        await L.clickText(page, 'button[type="submit"]', 'Save')
        const saved = await waitToast(page, /saved|fail|check/i)
        t.ok('save shows "Organization saved"', /saved/i.test(saved), saved)
        await page.waitForFunction((id) => location.pathname.endsWith(id), { timeout: 15000 }, orgB.id).catch(() => {})
        const orgB2 = await p.organization.findUnique({ where: { id: orgB.id } })
        t.ok('DB: logo stored as /uploads/… url', /^\/uploads\//.test(orgB2.logo || ''), orgB2.logo)
        await L.sleep(1500)
        const detail = await page.evaluate(() => document.body.innerText)
        t.ok('detail page shows stats (Events / Members)', /Events/.test(detail) && /Members/.test(detail))
        await L.shot(page, 'ui-ent-org-detail-1440')
      }
    }

    // 4. Members: invite dialog as an enterprise admin whose global role is USER
    t.section('Members (form)')
    await go(page, '/admin/enterprise/members')
    await L.waitText(page, `UI Owner ${run}`, 15000)
    await L.shot(page, 'ui-ent-members-1440')
    const memText = await page.evaluate(() => document.body.innerText)
    t.ok('members table shows the Owner badge', /Owner/.test(memText))
    const ownerActions = await page.$(`[aria-label="Actions for UI Owner ${run}"]`)
    t.ok('no actions menu on the owner row', !ownerActions)
    const viewerActions = await page.$(`[aria-label="Actions for UI Viewer ${run}"]`)
    t.ok('actions menu (change role / remove) is offered on a Viewer row', !!viewerActions,
      'the page decides with useRBAC().role (the GLOBAL role, USER here) instead of the enterprise role, so getManageableRoles(USER) = [] and no row can be managed')
    await L.clickText(page, 'button', 'Invite')
    await page.waitForSelector('#invite-emails', { timeout: 10000 }).catch(() => {})
    const dlgText = await page.evaluate(() => (document.querySelector('[role="dialog"]') || document.body).innerText)
    const blocked = /can.t invite members/i.test(dlgText)
    t.ok('invite dialog lets an Enterprise Admin pick a role', !blocked,
      'dialog says "Your role can\'t invite members." and the submit is disabled: InviteMemberDialog gets role={useRBAC().role}, the global role (USER), not the enterprise role')
    await L.shot(page, 'ui-ent-invite-dialog-1440')
    if (!blocked) {
      await page.type('#invite-emails', invitee.email)
      await selectOption(page, '#invite-role', 'Coordinator')
      await L.clickText(page, '[role="dialog"] button[type="submit"]', 'Send invitation')
      const inv = await waitToast(page, /added|sent|fail|already/i)
      t.ok('invite toast confirms', /added|sent/i.test(inv), inv)
    }
    await page.keyboard.press('Escape')
    await L.sleep(500)
    // Removed tab + search
    const tabbed = await L.clickReal(page, '[role="tab"], button', 'Removed')
    t.ok('Removed tab exists', tabbed)
    await L.sleep(1500)
    t.ok('Removed tab shows its empty state', /No removed members/i.test(await page.evaluate(() => document.body.innerText)))
    await L.clickReal(page, '[role="tab"], button', 'Active')
    await page.type('input[placeholder^="Search by name or email"]', `ui-viewer-${run}`)
    await L.sleep(1800)
    const rows = await page.evaluate(() => document.querySelectorAll('tbody tr').length)
    t.ok('member search narrows to 1 row', rows === 1, rows)

    // 5. Settings: approval toggle persists
    t.section('Settings (form)')
    await go(page, '/admin/enterprise/settings')
    await L.waitText(page, 'Require event approval', 15000)
    await L.sleep(1000)
    const sw = '[aria-labelledby$="-label"][role="switch"]'
    const state0 = await page.evaluate(() => { const s = [...document.querySelectorAll('[role="switch"]')].find((e) => /approval/i.test((document.getElementById(e.getAttribute('aria-labelledby')) || {}).innerText || '')); return s ? s.getAttribute('aria-checked') : null })
    t.eq('approval switch loads as ON', state0, 'true')
    await page.evaluate(() => { const s = [...document.querySelectorAll('[role="switch"]')].find((e) => /approval/i.test((document.getElementById(e.getAttribute('aria-labelledby')) || {}).innerText || '')); s && s.click() })
    await L.clickText(page, 'button', 'Save')
    const sv = await waitToast(page, /saved|fail/i)
    t.ok('save shows "Settings saved"', /saved/i.test(sv), sv)
    await go(page, '/admin/enterprise/settings')
    await L.waitText(page, 'Require event approval', 15000)
    await L.sleep(1200)
    const state1 = await page.evaluate(() => { const s = [...document.querySelectorAll('[role="switch"]')].find((e) => /approval/i.test((document.getElementById(e.getAttribute('aria-labelledby')) || {}).innerText || '')); return s ? s.getAttribute('aria-checked') : null })
    t.eq('after reload the switch is OFF', state1, 'false')
    const entS = await p.enterprise.findUnique({ where: { id: ENT }, select: { settings: true } })
    t.eq('DB: requireEventApproval false', entS.settings && entS.settings.requireEventApproval, false)
    void sw
    await L.shot(page, 'ui-ent-settings-1440')

    // 6. Branding: custom domain needs DNS verification
    t.section('Branding (form)')
    await go(page, '/admin/enterprise/branding')
    await page.waitForSelector('#brand-domain', { timeout: 15000 }).catch(() => {})
    const hasDomain = !!(await page.$('#brand-domain'))
    t.ok('custom domain field is present', hasDomain)
    if (hasDomain) {
      await page.type('#brand-domain', `${SLUG}.example.invalid`)
      await page.evaluate(() => { const i = document.getElementById('brand-domain'); const f = i && i.closest('form'); const b = f && f.querySelector('button[type="submit"]'); b && b.click() })
      const ok = await L.waitText(page, /DNS isn.t pointing here yet|CNAME/i, 20000)
      t.ok('verify explains the CNAME it needs', ok)
      const entD = await p.enterprise.findUnique({ where: { id: ENT }, select: { customDomain: true } })
      t.eq('DB: customDomain still null', entD.customDomain, null)
    }
    await L.shot(page, 'ui-ent-branding-1440')

    // 7. Events: KPI + approve
    t.section('Events (approve)')
    await go(page, '/admin/enterprise/events')
    await L.waitText(page, `UI Published`, 15000)
    await L.sleep(1000)
    await L.shot(page, 'ui-ent-events-1440')
    const evText = await page.evaluate(() => document.querySelector('main').innerText)
    const pubDb = await p.event.count({ where: { deletedAt: null, status: { in: ['PUBLISHED', 'REGISTRATION_OPEN'] }, OR: [{ enterpriseId: ENT }, { organization: { enterpriseId: ENT } }] } })
    const m = evText.match(/Published\s*\n\s*(\d+)/)
    if (m && Number(m[1]) !== pubDb && /On this page/i.test(evText)) {
      t.note(`Events KPIs "Published/Ongoing/Completed" count only the 10 rows on screen (labelled "On this page"): page shows ${m[1]} published while the enterprise has ${pubDb}. An events office needs enterprise-wide counts.`)
    } else {
      t.ok(`Events KPI "Published" equals the DB (${pubDb})`, m && Number(m[1]) === pubDb, `page shows ${m && m[1]}`)
    }
    t.ok('events page has a "Pending approval" filter', /Pending approval/i.test(evText) && (await page.$$('select, [role="combobox"], [role="tab"]')).length > 0,
      'no status filter: with dozens of clubs the pending events have to be found by scrolling')
    // "All events" is newest first, so a pending event can be on page 2; the Pending approval tab
    // (with its highlighted count) is where the office finds it
    await L.clickReal(page, '[role="tab"]', 'Pending approval'); await L.sleep(1800)
    const pendText = await page.evaluate(() => document.querySelector('main').innerText)
    t.ok('the event waiting for approval is on the Pending approval tab', pendText.includes(`UI Pending ${run}`), 'not listed on the Pending tab')
    await L.clickReal(page, '[role="tab"]', 'All events'); await L.sleep(1200)
    await page.type('input[placeholder^="Search events"]', `UI Pending ${run}`)
    await L.sleep(1800)
    const approveClicked = await page.evaluate((title) => {
      const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes(title))
      const b = row && [...row.querySelectorAll('button')].find((x) => /approve/i.test(x.innerText))
      if (b) { b.click(); return true } return false
    }, `UI Pending ${run}`)
    t.ok('Approve button on the pending row', approveClicked)
    const ap = await waitToast(page, /published|wrong|fail/i)
    t.ok('approve toast confirms', /published/i.test(ap), ap)
    t.eq('DB: event PUBLISHED', (await p.event.findUnique({ where: { id: pending.id } })).status, 'PUBLISHED')
    t.note('Reject in the Events table is one click with no confirmation and no reason field (the API accepts a reason); the club only hears "was rejected."')

    // 8. Registrations / payments / audit: search + export
    t.section('Registrations / payments / audit (search + export)')
    for (const [pg, needle] of [['/admin/enterprise/registrations', `E2E-${run}-UI1`], ['/admin/enterprise/payments', `E2E-${run}-UIP1`], ['/admin/enterprise/audit-logs', 'Created organization']]) {
      await go(page, pg)
      await L.sleep(1200)
      const search = await page.$('input[placeholder^="Search"]')
      if (search) {
        await search.type(needle)
        await L.sleep(1800)
        const found = (await page.evaluate(() => document.querySelector('main').innerText)).includes(needle.replace(/^E2E-/, '')) || (await page.evaluate((n) => document.body.innerText.includes(n), needle))
        t.ok(`${pg}: search "${needle}" shows the row`, found)
      } else t.ok(`${pg}: has a search box`, false)
      const before = exportHits.length
      const clicked = await L.clickText(page, 'button', 'Export')
      const tx = await waitToast(page, /export/i)
      await L.sleep(500)
      const hit = exportHits.slice(before).pop()
      t.ok(`${pg}: Export downloads a CSV`, clicked && hit && hit.status === 200 && /text\/csv/.test(hit.ct) && /downloaded/i.test(tx), { clicked, hit, tx })
      await L.shot(page, `ui-ent${pg.replace(/\//g, '_')}-1440`)
    }

    // 9. Hub "Create event": pick an org, land in the wizard with that org selected
    t.section('Hub: Create event + Invite buttons')
    await go(page, '/admin/enterprise')
    await L.clickText(page, 'button', 'Create event')
    await page.waitForSelector('#event-org', { timeout: 10000 }).catch(() => {})
    const picked = await selectOption(page, '#event-org', `UI Club A ${run}`).catch(() => false)
    t.ok('Create event dialog lists the clubs', picked)
    await L.clickText(page, '[role="dialog"] button[type="submit"]', '')
    await page.waitForFunction(() => location.pathname === '/admin/org/events/create', { timeout: 20000 }).catch(() => {})
    t.ok('continues into the event wizard', page.url().endsWith('/admin/org/events/create'), page.url())
    const ctx = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('eventflow-auth')).state.currentOrganizationId } catch { return null } })
    t.eq('wizard runs in the chosen club', ctx, orgA.id)
    await L.sleep(2000)
    await L.shot(page, 'ui-ent-wizard-1440')
    // switch the context back to the enterprise for the remaining pages
    await page.evaluate((ent) => localStorage.setItem('eventflow-auth', JSON.stringify({ state: { currentEnterpriseId: ent, currentOrganizationId: null }, version: 0 })), ENT)

    // 10. Billing
    t.section('Billing (no Razorpay keys)')
    await go(page, '/admin/enterprise/billing')
    await L.waitText(page, 'Change plan', 15000)
    await L.clickText(page, 'button', 'Change plan')
    await L.sleep(800)
    const up = await L.clickText(page, 'button', 'Upgrade')
    const bt = await waitToast(page, /configured|fail|payment/i)
    t.ok('Upgrade shows "Payments are not configured"', up && /not configured/i.test(bt), bt)
    const contact = await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find((x) => /contact sales/i.test(x.innerText)); return a ? a.getAttribute('href') : null })
    t.ok('Enterprise plan offers "Contact sales"', !!contact, contact)
    await L.shot(page, 'ui-ent-billing-1440')

    // 11. Phone width
    t.section('Phone 390')
    await L.setWidth(page, 390)
    for (const pg of ['/admin/enterprise', '/admin/enterprise/organizations', '/admin/enterprise/members', '/admin/enterprise/events', '/admin/enterprise/registrations', '/admin/enterprise/payments', '/admin/enterprise/audit-logs', '/admin/enterprise/settings', '/admin/enterprise/branding', '/admin/enterprise/billing']) {
      await go(page, pg)
      await L.sleep(1200)
      const ox = await L.overflowX(page)
      t.ok(`${pg} @390: no horizontal page scroll`, ox <= 1, `${ox}px wider than the screen`)
      // row actions ("⋯") are pinned to the table's right edge on phones: reachable without scrolling sideways
      const offscreen = await page.$$eval('[aria-label^="Actions for"]', (els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.right > window.innerWidth).length)
      t.ok(`${pg} @390: row actions on screen`, offscreen === 0, `${offscreen} "Actions for" buttons past the right edge`)
      await L.shot(page, `ui-ent${pg.replace(/\//g, '_')}-390`)
    }
    const pageErrors = page.__errors.filter((e) => !/ResizeObserver/.test(e))
    t.ok('no uncaught page errors during the walk', pageErrors.length === 0, pageErrors.slice(0, 5))

    // 12. What an enterprise-level Viewer sees
    t.section('Enterprise Viewer')
    const v = await L.browserLogin(browser, viewer.email, L.E2E_PASSWORD)
    const st = []
    v.page.on('response', (r) => { if (r.url().includes('/api/admin/enterprise/')) st.push(`${r.status()} ${r.url().split('/api/admin/enterprise/')[1].split('?')[0]}`) })
    await go(v.page, '/admin')
    await v.page.waitForFunction(() => location.pathname !== '/admin', { timeout: 15000 }).catch(() => {})
    await L.sleep(2500)
    await L.shot(v.page, 'ui-ent-viewer-hub-1440')
    const vText = await v.page.evaluate(() => document.body.innerText)
    t.ok('a Viewer gets a working read-only hub', !st.some((s) => s.startsWith('403')), `${v.page.url()} API: [${st.join(', ')}]; ${vText.replace(/\s+/g, ' ').slice(0, 120)}`)
  })
}

main()
  .catch((e) => t.ok('script aborted', false, e && (e.stack || e.message)))
  .finally(async () => {
    if (process.env.E2E_KEEP !== '1') await L.cleanupAll().catch((e) => console.error('cleanup failed', e))
    try { fs.unlinkSync(path.join(L.OUT, `logo-${run}.png`)) } catch { /* */ }
    const fails = t.save()
    await db().$disconnect()
    process.exit(fails ? 1 : 0)
  })
