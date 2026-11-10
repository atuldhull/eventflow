// Settings: every field saves and reloads, invalid values are flagged, "Require approval" event
// default pre-fills the wizard; values are put back at the end of the step.
// Website builder: create the site from a template, change a section in the editor, save,
// preview, publish -> public site API live -> unpublish; media add by URL and delete.
const L = require('./lib.cjs')

L.run('08-settings-website', async (T, browser) => {
  const S = L.state()
  const db = L.db()
  const { orgId } = await L.orgIds()
  const snap = await L.snapshotOrg()
  const org = await L.session(browser, 'alice')
  const vals = {
    '#org-name': `${snap.orgFields.name} E2E`, '#org-description': 'E2E-ORG settings test description', '#org-phone': '9876543210',
    '#org-gstin': '29ABCDE1234F1Z5', '#org-pan': 'ABCDE1234F', '#org-address': 'E2E Street 1', '#org-city': 'E2E City', '#org-state': 'Karnataka',
    '#org-pin': '560001', '#org-website': 'https://e2e-org.example.com',
  }

  const restore = async () => {
    const o = await db.organization.findUnique({ where: { id: orgId }, select: { settings: true } })
    const s = { ...(o.settings || {}) }
    const before = snap.orgSettings || {}
    for (const k of ['billing', 'eventDefaults']) { if (k in before) s[k] = before[k]; else delete s[k] }
    await db.organization.update({ where: { id: orgId }, data: { ...snap.orgFields, settings: Object.keys(s).length ? s : (snap.orgSettings === null ? require(L.ROOT + '/node_modules/@prisma/client').Prisma.DbNull : {}) } })
  }

  await T.step('settings: invalid values are flagged', async () => {
    await L.goto(org, '/admin/org/settings')
    await org.waitForSelector('#org-gstin', { timeout: 20000 })
    await L.typeInto(org, '#org-gstin', 'BAD-GST')
    await L.clearToasts(org)
    await L.clickText(org, 'Save changes')
    const toast = await L.waitToast(org)
    T.ok('bad GSTIN refused ("Check the highlighted fields")', toast && toast.type === 'error', toast)
    T.ok('the GSTIN field is highlighted', await org.$eval('#org-gstin', (e) => e.getAttribute('aria-invalid') === 'true'))
  })

  await T.step('settings: every field saves and reloads', async () => {
    await L.goto(org, '/admin/org/settings')
    await org.waitForSelector('#org-name', { timeout: 20000 })
    for (const [sel, v] of Object.entries(vals)) await L.typeInto(org, sel, v)
    T.ok('Require approval default switches on', await L.setSwitch(org, '#org-require-approval', true).catch(() => L.setSwitch(org, 'Require approval', true)))
    await L.clearToasts(org)
    await L.clickText(org, 'Save changes')
    const toast = await L.waitToast(org)
    T.ok('"Settings saved" toast', toast && /saved/i.test(toast.text), toast)
    await L.goto(org, '/admin/org/settings')
    await org.waitForSelector('#org-name')
    await L.sleep(1000)
    const shown = {}
    for (const sel of Object.keys(vals)) shown[sel] = await org.$eval(sel, (e) => e.value)
    const bad = Object.entries(vals).filter(([k, v]) => shown[k] !== v)
    T.ok('all fields show the saved values after reload', bad.length === 0, bad.map(([k, v]) => `${k}: ${shown[k]} != ${v}`))
    const o = await db.organization.findUnique({ where: { id: orgId } })
    T.ok('DB has the profile fields', o.name === vals['#org-name'] && o.phone === '9876543210' && o.city === 'E2E City' && o.website === vals['#org-website'], { name: o.name, phone: o.phone })
    T.ok('DB has billing (GSTIN/PAN/PIN) and eventDefaults.requireApproval', o.settings?.billing?.gstin === '29ABCDE1234F1Z5' && o.settings?.eventDefaults?.requireApproval === true, o.settings && { billing: o.settings.billing, ev: o.settings.eventDefaults })
    T.ok('audit: settings change logged', !!(await db.auditLog.findFirst({ where: { organizationId: orgId, entityType: 'ORGANIZATION', createdAt: { gte: new Date(Date.now() - 120000) } } })))
    await L.shot(org, '08-settings')
  })

  await T.step('event default "Require approval" pre-fills the wizard', async () => {
    await L.goto(org, '/admin/org/events/create')
    await org.waitForSelector('#ev-title')
    await L.sleep(1500)
    await L.typeInto(org, '#ev-title', `${L.TITLE_PREFIX} Defaults check`)
    await L.typeInto(org, '#ev-short', 'Checking the event defaults.')
    await L.typeInto(org, '#ev-desc', 'Checking that the organization event defaults pre-fill the wizard switches for new events.')
    await L.selectOption(org, '#ev-category', 'Meetup')
    await L.clickText(org, /^Next$/)
    await org.waitForSelector('#ev-start')
    await L.setValue(org, '#ev-start', '2027-01-10T10:00')
    await L.setValue(org, '#ev-end', '2027-01-10T12:00')
    await L.clickText(org, /^Next$/)
    await org.waitForSelector('[role="switch"][aria-label="Require approval"]')
    const on = await org.$eval('[role="switch"][aria-label="Require approval"]', (e) => e.getAttribute('aria-checked') === 'true' || e.hasAttribute('data-checked'))
    T.ok('Require approval is already on in a new event', on)
  })
  await T.step('settings put back', async () => {
    await restore()
    const o = await db.organization.findUnique({ where: { id: orgId } })
    T.ok('org profile restored', o.name === snap.orgFields.name && o.phone === snap.orgFields.phone)
  })

  // ---------------- website builder ----------------
  const hadSite = await db.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (hadSite && !S.snapshot.siteConfig) { const s = L.state(); s.snapshot.siteConfig = hadSite; L.saveState(s) }
  await T.step('create the website from a template', async () => {
    await L.goto(org, '/admin/org/website')
    await L.sleep(1500)
    if (!hadSite) T.ok('no site yet: page offers "Browse templates"', !!(await L.findByText(org, 'a', 'Browse templates', { timeout: 5000 })))
    await L.goto(org, '/admin/org/website/templates/tech-community-dark')
    await L.clickText(org, /Use this template|Current template/)
    if (!hadSite) {
      T.ok('confirm dialog explains where the site goes', await L.waitText(org, 'Create your website with', 8000))
      T.info(`dialog says: ${(await L.bodyText(org)).match(/Your website will be live at [^.]*\.[^.]*\.com/)}`)
      await L.clearToasts(org)
      await L.clickText(org, 'Create website', '[role="dialog"] button')
      const toast = await L.waitToast(org)
      T.ok('"Website created" toast', toast && /created/i.test(toast.text), toast)
      const sc = await db.siteConfig.findUnique({ where: { organizationId: orgId } })
      T.ok('site config created for Tech Club (unpublished)', sc && !sc.isPublished)
      if (sc) L.track('siteConfigs', sc.id)
    }
  })

  await T.step('editor: hide a section, save, preview', async () => {
    await L.goto(org, '/admin/org/website/editor')
    const hide = await org.waitForSelector('button[aria-label="Hide section"]', { timeout: 30000 })
    const before = (await db.siteConfig.findUnique({ where: { organizationId: orgId } })).sections
    await hide.click()
    await L.sleep(400)
    await L.clearToasts(org)
    await L.clickText(org, /^Save$/)
    const toast = await L.waitToast(org)
    T.ok('"Saved!" toast', toast && /saved/i.test(toast.text), toast)
    const after = (await db.siteConfig.findUnique({ where: { organizationId: orgId } })).sections
    const off = (s) => (Array.isArray(s) ? s : []).filter((x) => x && x.enabled === false).length
    T.ok('one more section is hidden in the saved site', off(after) === off(before) + 1, { before: off(before), after: off(after) })
    await L.shot(org, '08-editor')
    await L.goto(org, '/admin/org/website/preview')
    await L.sleep(2500)
    T.ok('preview page renders', !/Failed to load|Something went wrong/i.test(await L.bodyText(org)) && org.__errors.filter((e) => /pageerror/.test(e)).length === 0, org.__errors.slice(-3))
    await L.shot(org, '08-preview')
  })

  await T.step('publish from the editor, then unpublish', async () => {
    await L.goto(org, '/admin/org/website/editor')
    await org.waitForSelector('button[aria-label="Hide section"], button[aria-label="Show section"]', { timeout: 30000 })
    await L.clickText(org, /^Publish$/)
    await L.clearToasts(org)
    await L.clickText(org, /^Publish$/, '[role="dialog"] button')
    const toast = await L.waitToast(org)
    T.ok('"Website published!" toast', toast && /published/i.test(toast.text), toast)
    T.ok('DB: site is published', (await db.siteConfig.findUnique({ where: { organizationId: orgId } })).isPublished === true)
    const pub = await L.api(org, 'GET', '/api/site/tech-club')
    T.ok('public site API serves the published site', pub.status === 200, pub.status)
    await L.goto(org, '/admin/org/website')
    await L.clearToasts(org)
    await L.clickText(org, /^Unpublish$/)
    const t2 = await L.waitToast(org)
    T.ok('"Website unpublished" toast', t2 && /unpublished/i.test(t2.text), t2)
    T.ok('DB: unpublished again', (await db.siteConfig.findUnique({ where: { organizationId: orgId } })).isPublished === false)
    const gone = await L.api(org, 'GET', '/api/site/tech-club')
    T.ok('public site API no longer serves it', gone.status === 404 || gone.json?.exists === false, { status: gone.status, exists: gone.json?.exists })
    const visit = await org.$eval('a[href^="https://"]', (a) => a.href).catch(() => null)
    if (visit && /eventflow\.com/.test(visit)) T.uxIssue('minor', '/admin/org/website', `"Visit" links to ${visit} (the production subdomain) even on this install, and the create dialog says the site "will be live" there before it is published.`, 'Build the site URL from NEXT_PUBLIC_ROOT_DOMAIN/app URL (or /site/<slug> locally) and say "after you publish".')
  })

  await T.step('media: add by URL and delete', async () => {
    const cover = (S.created.uploads || [])[0]
    await L.goto(org, '/admin/org/website/media')
    await L.clickText(org, /^Upload$/)
    await org.waitForSelector('#upload-url')
    const fileInput = await org.$('input[type="file"]')
    if (!fileInput) T.uxIssue('major', '/admin/org/website/media (Upload)', 'The "Upload" button opens a form asking for an "Image URL"; there is no way to pick a file from the computer, although the event wizard already uploads files. A club organizer with photos on their phone cannot add them.', 'Use the same /api/upload file picker / drag-and-drop as the event cover, keeping "add by URL" as a secondary option.')
    await L.typeInto(org, '#upload-url', `${L.BASE}${cover || '/icons/icon-192.png'}`)
    await L.typeInto(org, '#upload-name', 'e2e-org-media')
    await L.clearToasts(org)
    await org.click('form button[type="submit"]')
    const toast = await L.waitToast(org)
    T.ok('"File added!" toast', toast && /added/i.test(toast.text), toast)
    const m = await db.siteMedia.findFirst({ where: { fileName: 'e2e-org-media' } })
    T.ok('media row stored', !!m)
    if (m) L.track('siteMedia', m.id)
    T.ok('media grid shows it', await L.waitText(org, 'e2e-org-media', 10000))
    await org.click('button[aria-label="Open e2e-org-media"]')
    await L.sleep(600)
    await L.clearToasts(org)
    await L.clickText(org, /^Delete$/, '[role="dialog"] button')
    const t2 = await L.waitToast(org)
    T.ok('deleted (toast)', t2 && /deleted/i.test(t2.text), t2)
    T.ok('media row gone', m && !(await db.siteMedia.findUnique({ where: { id: m.id } })))
    T.uxIssue('minor', '/admin/org/website/media (detail drawer)', 'Delete removes the file immediately with no confirmation, even if it is used on the site.', 'Confirm and show where the file is used (the media/usage API exists).')
    const js = await L.api(org, 'POST', `/api/admin/org/${orgId}/website/media`, { fileName: 'e2e-org-js', fileUrl: 'javascript:alert(1)', fileType: 'image/jpeg' })
    T.ok('media API refuses a javascript: URL', js.status >= 400, { status: js.status })
    const jsRow = await db.siteMedia.findFirst({ where: { fileName: 'e2e-org-js' } })
    if (jsRow) { L.track('siteMedia', jsRow.id); await db.siteMedia.delete({ where: { id: jsRow.id } }) }
  })
  await L.closeSession(org)
})
