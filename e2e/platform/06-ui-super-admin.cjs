// Platform operator (super admin) UI walkthrough in a headless browser, desktop 1440 + phone 390.
// Acts only on an e2e-ent- user and an "E2E-ENT …" enterprise created through the UI itself.
// Settings are only read here (03-platform-settings.cjs changes them). Screenshots: out/shots/ui-sa-*.png
// Usage: node e2e/platform/06-ui-super-admin.cjs
'use strict'
const L = require('./lib.cjs')
const { db, PREFIX, NAME_PREFIX } = L

const t = L.makeT('06-ui-super-admin')
const run = L.runId()
const ENT_NAME = `${NAME_PREFIX} SAUI ${run}`

const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((e) => e.innerText).join(' | '))
async function waitToast(page, re, timeout = 12000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { const x = await toastText(page); if (re.test(x)) return x; await L.sleep(300) }
  return toastText(page)
}
async function go(page, p) { await page.goto(L.BASE + p, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}); await L.sleep(800) }
async function menuItem(page, text) {
  await page.waitForSelector('[role="menuitem"]', { timeout: 8000 }).catch(() => {})
  for (const h of await page.$$('[role="menuitem"]')) {
    if ((await h.evaluate((e) => e.innerText.trim())).toLowerCase() === text.toLowerCase()) { await h.click(); return true }
  }
  return false
}
async function openActions(page, name) {
  const h = await page.$(`[aria-label="Actions for ${name}"]`)
  if (!h) return false
  await h.click(); return true
}
async function selectOption(page, triggerSel, optionText) {
  await page.click(triggerSel)
  await page.waitForSelector('[role="option"]', { timeout: 8000 })
  for (const h of await page.$$('[role="option"]')) {
    if ((await h.evaluate((e) => e.innerText)).toLowerCase().includes(optionText.toLowerCase())) { await h.click(); await L.sleep(300); return true }
  }
  return false
}
const mainText = (page) => page.evaluate(() => (document.querySelector('main') || document.body).innerText)
const kpi = (text, label) => { const m = text.match(new RegExp(`${label}\\s*\\n\\s*([\\d,]+)`)); return m ? Number(m[1].replace(/,/g, '')) : null }

async function main() {
  if (!(await L.serverUp())) throw new Error('dev server not responding on ' + L.BASE)
  const p = db()
  const victim = await L.createUser(`saui-victim-${run}`, { name: `SAUI Victim ${run}` })
  const admin = await L.loginAs('admin')

  await L.withBrowser(async (browser) => {
    const { page } = await L.browserLogin(browser, ...L.ACCOUNTS.admin)

    t.section('Overview (1440)')
    await go(page, '/super-admin')
    await L.waitText(page, /Total users|Users/, 15000); await L.sleep(1500)
    await L.shot(page, 'ui-sa-overview-1440')
    const ov = await mainText(page)
    const d = (await admin.get('/api/super-admin/dashboard-stats')).body.data
    t.ok('overview KPIs show the API totals (users, events)', ov.includes(String(d.totalUsers)) && ov.includes(String(d.totalEvents)), { totalUsers: d.totalUsers, totalEvents: d.totalEvents, text: ov.slice(0, 200) })

    t.section('Users: KPIs, search, ban/unban, role')
    await go(page, '/super-admin/users')
    await L.waitText(page, 'Total users', 15000); await L.sleep(1200)
    const ut = await mainText(page)
    const st = (await admin.get('/api/super-admin/users?limit=1')).body.stats
    t.eq('users KPI strip equals the API', [kpi(ut, 'Total users'), kpi(ut, 'Active'), kpi(ut, 'Banned'), kpi(ut, 'New this month')], [st.total, st.active, st.banned, st.newThisMonth])
    t.ok('no actions menu on my own row', !(await page.$('[aria-label="Actions for Super Admin"]')))
    const hasFilters = (await page.$$('main [role="combobox"], main select, main [role="tab"]')).length > 0
    t.ok('users list can be filtered by role / banned', hasFilters, 'only a search box; the API already supports ?role= and ?status=banned')
    await page.type('input[placeholder^="Search by name, email"]', victim.email)
    await L.sleep(1800)
    t.eq('search narrows to 1 row', await page.evaluate(() => document.querySelectorAll('tbody tr').length), 1)
    t.ok('row actions menu opens', await openActions(page, victim.name))
    t.ok('"Ban user" item', await menuItem(page, 'Ban user'))
    await page.waitForSelector('#ban-reason', { timeout: 8000 }).catch(() => {})
    await page.type('#ban-reason', 'E2E UI ban')
    await L.shot(page, 'ui-sa-ban-dialog-1440')
    await L.clickText(page, '[role="dialog"] button[type="submit"]', '')
    const bt = await waitToast(page, /banned|fail/i)
    t.ok('ban toast', /banned/i.test(bt), bt)
    await L.sleep(1200)
    t.ok('row now says Banned', /Banned/.test(await page.evaluate(() => document.querySelector('tbody').innerText)))
    const vb = await p.user.findUnique({ where: { id: victim.id } })
    t.ok('DB: banned with the reason', vb.isBanned && vb.banReason === 'E2E UI ban', vb)
    const ut2 = await mainText(page)
    t.eq('Banned KPI went up by 1 without a reload', kpi(ut2, 'Banned'), st.banned + 1)
    await openActions(page, victim.name)
    t.ok('"Unban user" item', await menuItem(page, 'Unban user'))
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {})
    await L.clickText(page, '[role="dialog"] button[type="submit"]', '')
    const ubt = await waitToast(page, /unbanned|fail/i)
    t.ok('unban toast', /unbanned/i.test(ubt), ubt)
    t.eq('DB: unbanned', (await p.user.findUnique({ where: { id: victim.id } })).isBanned, false)
    await openActions(page, victim.name)
    t.ok('"Change role" item', await menuItem(page, 'Change role'))
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {})
    const trig = await page.waitForSelector('#user-role', { timeout: 8000 }).catch(() => null)
    if (trig) {
      await selectOption(page, '#user-role', 'Viewer')
      await L.clickReal(page, '[role="dialog"] button[type="submit"]', 'Save role')
      const rt = await waitToast(page, /is now|role|fail/i)
      t.ok('role change toast', /updated|is now/i.test(rt), rt)
      t.eq('DB: role VIEWER', (await p.user.findUnique({ where: { id: victim.id } })).role, 'VIEWER')
    } else t.ok('role dialog has a role picker', false)
    await page.keyboard.press('Escape')

    t.section('Enterprises: create, verify, deactivate, delete (typed)')
    await t.step('create enterprise through the dialog', async () => {
    await go(page, '/super-admin/enterprises')
    await L.waitText(page, 'New enterprise', 15000)
    await L.clickReal(page, 'button', 'Add enterprise')
    if (!(await page.waitForSelector('#ent-name', { timeout: 10000 }).catch(() => null))) throw new Error('"New enterprise" dialog did not open in the headless run (inconclusive; API create is covered by 02)')
    await page.type('#ent-name', ENT_NAME)
    const slug = await page.$eval('#ent-slug', (e) => e.value)
    t.ok('slug auto-fills from the name', slug.length > 3, slug)
    await page.$eval('#ent-slug', (e) => e.select())
    await page.type('#ent-slug', `${PREFIX}saui-${run}`)
    await page.type('#ent-email', `${PREFIX}saui-${run}@test.local`)
    await selectOption(page, '#ent-type', 'University').catch(() => {})
    if (await page.$('#ent-owner')) await page.type('#ent-owner', 'admin@eventflow.com')
    const ownerField = /owner/i.test(await page.evaluate(() => (document.querySelector('[role="dialog"]') || document.body).innerText))
    t.ok('create dialog lets the operator name the owner', ownerField, 'no owner field: the enterprise is always owned by the signed-in super admin')
    await L.shot(page, 'ui-sa-new-enterprise-1440')
    await L.clickText(page, '[role="dialog"] button[type="submit"]', '')
    const ct = await waitToast(page, /created|fail/i)
    t.ok('create toast', /created/i.test(ct), ct)
    })
    let ent = await p.enterprise.findFirst({ where: { slug: `${PREFIX}saui-${run}` } })
    t.ok('DB: enterprise created from the dialog', !!ent)
    if (!ent) {
      // fall back to the API so the row actions and the typed delete are still exercised in the UI
      const r = await admin.post('/api/super-admin/enterprises', { name: ENT_NAME, slug: `${PREFIX}saui-${run}`, email: `${PREFIX}saui-${run}@test.local`, type: 'UNIVERSITY', ownerEmail: 'admin@eventflow.com' })
      ent = r.body && r.body.data
    }
    if (ent) await t.step('row actions + typed delete', async () => {
      await go(page, '/super-admin/enterprises')
      await page.type('input[placeholder^="Search enterprises"]', run)
      await L.sleep(1800)
      await openActions(page, ENT_NAME); t.ok('Verify item', await menuItem(page, 'Verify')); await L.sleep(1500)
      t.eq('DB: verified', (await p.enterprise.findUnique({ where: { id: ent.id } })).isVerified, true)
      await openActions(page, ENT_NAME); t.ok('Deactivate item', await menuItem(page, 'Deactivate'))
      // Deactivating locks every member out, so it asks for the name to be typed first
      const asked = !!(await page.waitForSelector('#typed-confirm', { timeout: 8000 }).catch(() => null))
      t.ok('Deactivate asks for the name to be typed', asked)
      t.eq('DB: still active until confirmed', (await p.enterprise.findUnique({ where: { id: ent.id } })).isActive, true)
      if (asked) {
        await page.type('#typed-confirm', ENT_NAME)
        await L.clickText(page, '[role="dialog"] button[type="submit"]', '')
        await L.sleep(1500)
      }
      t.eq('DB: deactivated after typing the name', (await p.enterprise.findUnique({ where: { id: ent.id } })).isActive, false)
      await openActions(page, ENT_NAME); t.ok('Activate item', await menuItem(page, 'Activate')); await L.sleep(1500)
      t.eq('DB: active again', (await p.enterprise.findUnique({ where: { id: ent.id } })).isActive, true)
      await openActions(page, ENT_NAME); t.ok('Delete item', await menuItem(page, 'Delete'))
      await page.waitForSelector('#typed-confirm', { timeout: 8000 }).catch(() => {})
      const disabled0 = await page.$eval('[role="dialog"] button[type="submit"]', (b) => b.disabled)
      t.ok('Delete is disabled until the name is typed', disabled0)
      await page.type('#typed-confirm', 'Demo University')
      t.ok('…and stays disabled for another name', await page.$eval('[role="dialog"] button[type="submit"]', (b) => b.disabled))
      await page.$eval('#typed-confirm', (e) => e.select())
      await page.type('#typed-confirm', ENT_NAME)
      t.ok('…and enables for the right name', !(await page.$eval('[role="dialog"] button[type="submit"]', (b) => b.disabled)))
      await L.shot(page, 'ui-sa-delete-dialog-1440')
      await L.clickText(page, '[role="dialog"] button[type="submit"]', '')
      const dt = await waitToast(page, /deleted|fail/i)
      t.ok('delete toast', /deleted/i.test(dt), dt)
      t.ok('DB: soft-deleted', !!(await p.enterprise.findUnique({ where: { id: ent.id } })).deletedAt)
    })

    t.section('Settings (read only) + test email')
    await go(page, '/super-admin/settings')
    await L.waitText(page, 'Maintenance', 15000); await L.sleep(1000)
    await L.shot(page, 'ui-sa-settings-1440')
    const saveDisabled = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^save/i.test(x.innerText.trim())); return b ? b.disabled : null })
    t.ok('Save is disabled until something changes', saveDisabled === true, saveDisabled)
    await L.clickReal(page, '[role="tab"]', 'Email'); await L.sleep(600)
    const sent = await L.clickReal(page, 'button', 'Send test email')
    const tt = await waitToast(page, /email|fail|smtp|resend/i, 20000)
    // with a mail server the toast says "sent to"; without one it must show the sender's real error
    const ttDb = await p.auditLog.findFirst({ where: { entityType: 'PLATFORM', entityId: 'test-email' }, orderBy: { createdAt: 'desc' } })
    const ttTruth = /sent to/i.test(tt) ? !!ttDb && /sent/i.test(ttDb.description) : /fail|not set|smtp|resend/i.test(tt)
    t.ok('test email toast tells the truth (matches the audit log)', sent && ttTruth, { sent, tt, audit: ttDb && ttDb.description })
    let settingsText = ''
    for (const tab of ['Features', 'Security']) { await L.clickReal(page, '[role="tab"]', tab); await L.sleep(600); settingsText += await mainText(page) }
    await L.shot(page, 'ui-sa-settings-security-1440')
    t.ok('settings that do nothing yet are labelled as such', /not (yet )?enforced|coming soon|no effect/i.test(settingsText),
      'Max login attempts, lockout, session timeout, 2FA for admins, email verification, public event creation, enterprise self-registration and SMS toggles are saved but never read by the app')

    t.section('Other pages load')
    for (const pg of ['/super-admin/events', '/super-admin/organizations', '/super-admin/subscriptions', '/super-admin/messages', '/super-admin/audit', '/super-admin/analytics']) {
      const before = page.__errors.length
      await go(page, pg); await L.sleep(1500)
      const txt = await mainText(page)
      t.ok(`${pg} renders without errors`, page.__errors.length === before && txt.length > 50, page.__errors.slice(before))
      await L.shot(page, `ui-sa${pg.replace(/\//g, '_')}-1440`)
    }
    await go(page, '/super-admin/audit'); await L.sleep(1500)
    t.ok('audit page lists the ban', /Banned user: SAUI Victim/.test(await mainText(page)) || /SAUI Victim/.test(await mainText(page)))

    t.section('Phone 390')
    await L.setWidth(page, 390)
    for (const pg of ['/super-admin', '/super-admin/users', '/super-admin/enterprises', '/super-admin/events', '/super-admin/organizations', '/super-admin/subscriptions', '/super-admin/messages', '/super-admin/audit', '/super-admin/settings', '/super-admin/analytics']) {
      await go(page, pg); await L.sleep(1200)
      const ox = await L.overflowX(page)
      t.ok(`${pg} @390: no horizontal page scroll`, ox <= 1, `${ox}px`)
      await L.shot(page, `ui-sa${pg.replace(/\//g, '_') || '_home'}-390`)
    }
    const errs = page.__errors.filter((e) => !/ResizeObserver/.test(e))
    t.ok('no uncaught page errors', errs.length === 0, errs.slice(0, 5))
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
