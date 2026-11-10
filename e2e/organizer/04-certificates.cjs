// Certificates for event A (after it ends): template creation (and "template use"), Pending ->
// Generate, attendee sees it, public verify valid -> revoke -> revoked -> restore -> valid,
// resend (no SMTP locally: the handled error path), download uses the template, audit rows.
const L = require('./lib.cjs')

L.run('04-certificates', async (T, browser) => {
  const S = L.state()
  const A = S.eventA
  if (!A || !S.walkin) throw new Error('Run 01-03 first')
  const db = L.db()
  const { orgId } = await L.orgIds()
  const org = await L.session(browser, 'alice')
  const tplName = `${L.TITLE_PREFIX} Template ${S.runId}`
  const certTitle = `${L.TITLE_PREFIX} Certificate of Attendance`

  await T.step('setup: a confirmed no-show, and the event ends', async () => {
    const student = await db.ticketType.findFirst({ where: { eventId: A.id, name: 'Student Pass' } })
    const email = `${L.EMAIL_PREFIX}noshow-${S.runId}@test.local`
    L.track('users', email)
    const add = await L.api(org, 'POST', `/api/admin/org/${orgId}/registrations`, { eventId: A.id, name: 'E2E Noshow', email, ticketTypeId: student.id })
    T.ok('no-show participant added (confirmed, never checked in)', add.status === 201 || add.status === 409, add.json)
    const y = new Date(); y.setDate(y.getDate() - 1)
    const start = new Date(y); start.setHours(10, 0, 0, 0)
    const end = new Date(y); end.setHours(17, 0, 0, 0)
    const r = await L.api(org, 'PATCH', `/api/admin/org/${orgId}/events/${A.id}`, { startDate: start.toISOString(), endDate: end.toISOString() })
    T.ok('event moved to yesterday (ended)', r.status === 200, r.json)
  })

  await T.step('pending tab without a template', async () => {
    await L.goto(org, '/admin/org/certificates')
    await L.clickText(org, 'Pending', '[role="tab"]')
    T.ok('ended event is listed as waiting for certificates', await L.waitText(org, A.title, 20000))
    const txt = await L.bodyText(org)
    T.ok('it says to create a template first, with a link', /Create a certificate template before generating/.test(txt))
    const btn = await L.findByText(org, 'button', /^Generate/, { timeout: 5000 })
    T.ok('Generate is disabled without a template', btn && (await btn.evaluate((b) => b.disabled)))
    await L.shot(org, '04-pending-no-template')
  })

  await T.step('create a template (UI)', async () => {
    await L.goto(org, '/admin/org/certificates/templates/create')
    await org.waitForSelector('#tpl-name')
    await L.typeInto(org, '#tpl-name', tplName)
    await L.typeInto(org, '#tpl-title', certTitle)
    await L.setSwitch(org, '#tpl-default', true).catch(() => L.setSwitch(org, '[role="switch"]', true))
    await L.clearToasts(org)
    await L.clickText(org, 'Save template')
    const toast = await L.waitToast(org)
    T.ok('"Template created!" toast', toast && /created/i.test(toast.text), toast)
    const tpl = await db.certificateTemplate.findFirst({ where: { name: tplName, organizationId: orgId } })
    T.ok('template stored for Tech Club', !!tpl)
    if (tpl) { L.track('certTemplates', tpl.id); L.setState('templateId', tpl.id) }
    T.ok('template HTML carries the certificate title', tpl && tpl.templateHtml.includes(certTitle))
  })

  let certs = []
  await T.step('generate from the Pending tab', async () => {
    await L.goto(org, '/admin/org/certificates')
    await L.clickText(org, 'Pending', '[role="tab"]')
    await L.waitText(org, A.title, 20000)
    const row = await L.findByText(org, 'li', A.title)
    const btn = await row.$('button')
    // "Generate…" opens a confirm dialog; it defaults to "checked-in only" for ended events
    await btn.click()
    await org.waitForSelector('[role="dialog"]', { timeout: 10000 })
    const confirmBtn = await L.findByText(org, '[role="dialog"] button', /^Generate \d+/, { timeout: 5000 })
    const label = confirmBtn ? await confirmBtn.evaluate((b) => b.innerText.trim()) : null
    const eligible = await db.registration.count({ where: { eventId: A.id, status: 'CHECKED_IN' } })
    T.ok(`dialog offers ${eligible} certificates (checked-in only by default)`, label === `Generate ${eligible}`, label)
    await L.clearToasts(org)
    await confirmBtn.click()
    const toast = await L.waitToast(org, 30000)
    T.ok('generate toast', toast && toast.type !== 'error', toast)
    await L.sleep(1000)
    certs = await db.certificate.findMany({ where: { eventId: A.id }, include: { user: { select: { email: true } } } })
    T.ok(`${eligible} certificates created with the new template`, certs.length === eligible && certs.every((c) => c.templateId === L.state().templateId), certs.map((c) => [c.recipientName, c.templateId]))
    const emails = certs.map((c) => c.user.email)
    T.ok('rejected and unpaid attendees get none', !emails.includes(S.att3.email) && !emails.includes(S.att4.email))
    const noShow = certs.find((c) => c.recipientName === 'E2E Noshow')
    T.ok('a confirmed no-show does not get an attendance certificate from the one-click Generate', !noShow, 'the Pending tab always sends recipientFilter "all_confirmed"; there is no "checked-in only" choice in the UI')
    if (noShow) T.uxIssue('major', '/admin/org/certificates (Pending -> Generate)', 'One-click Generate issues a PARTICIPATION certificate to every confirmed registration, including people who never checked in; the API supports "checked_in_only" but the UI offers no choice and does not say who will get one.', 'Before generating, show a small dialog: "Checked-in only (N) / All confirmed (M)", certificate type and template, defaulting to checked-in only for ended events.')
    T.ok('Issued tab opens after generating', await L.waitText(org, 'E2E Org Attendee One', 15000))
    T.ok('audit: certificates generated', !!(await db.auditLog.findFirst({ where: { eventId: A.id, description: { startsWith: 'Generated' } } })))
    await L.shot(org, '04-issued')
  })

  const c1 = certs.find((c) => c.user.email === S.att1.email)
  if (!c1) return
  const verify = async (label, expect) => {
    const anon = await L.session(browser, null)
    await L.goto(anon, `/verify/${c1.verificationCode}`)
    await L.sleep(800)
    const txt = await L.bodyText(anon)
    const ok = expect === 'valid' ? /Valid/.test(txt) && !/revoked/i.test(txt) : /Certificate revoked/i.test(txt)
    T.ok(label, ok, txt.slice(0, 300))
    await L.shot(anon, `04-verify-${expect}`)
    await L.closeSession(anon)
  }

  await T.step('attendee sees the certificate; verify says valid', async () => {
    const p = await L.session(browser, S.att1)
    await L.goto(p, '/dashboard/certificates')
    T.ok('attendee sees the certificate in their dashboard', await L.waitText(p, A.title, 15000) || (await L.bodyText(p)).includes(c1.title), c1.title)
    const dl = await L.api(p, 'GET', `/api/certificates/${c1.id}/download`)
    T.ok('attendee can open the certificate (download 200)', dl.status === 200, dl.status)
    T.ok('the download is a PDF attachment', /application\/pdf/.test(dl.headers.type || '') && /^attachment/.test(dl.headers.disposition || '') && (dl.text || '').startsWith('%PDF-'), dl.headers)
    // the PDF's text is uncompressed, so a short ASCII title appears as a "(...)" string
    const body = dl.text || JSON.stringify(dl.json || '')
    T.ok('the certificate uses the template (its title appears)', body.includes(certTitle), body.slice(0, 200))
    if (!body.includes(certTitle)) T.uxIssue('major', '/admin/org/certificates/templates/create -> attendee certificate', 'The certificate an attendee opens is always the built-in "Certificate of Participation" layout: /api/certificates/[id]/download calls generateCertificateHTML without the template, so the template name, title, body text and orientation the organizer set are ignored (templateId is stored but unused).', 'Render certificate.template.templateHtml (merge-tag replace, escaped values) in the download route, falling back to the built-in layout only when there is no template.')
    await L.shot(p, '04-attendee-certificates')
    await L.closeSession(p)
    await verify('public verify page says Valid', 'valid')
  })

  const openMenu = async (item) => {
    await L.goto(org, '/admin/org/certificates')
    await org.waitForSelector(`button[aria-label="Actions for E2E Org Attendee One's certificate"]`, { timeout: 20000 })
    await org.click(`button[aria-label="Actions for E2E Org Attendee One's certificate"]`)
    await L.clickText(org, item, '[role="menuitem"]')
  }

  await T.step('revoke', async () => {
    await openMenu('Revoke')
    T.ok('revoke asks for confirmation', await L.waitText(org, 'Revoke this certificate?', 8000))
    await L.clearToasts(org)
    await L.clickText(org, /^Revoke$/, '[role="dialog"] button')
    const toast = await L.waitToast(org)
    T.ok('"Certificate revoked" toast', toast && /revoked/i.test(toast.text), toast)
    const c = await db.certificate.findUnique({ where: { id: c1.id } })
    T.ok('DB: revokedAt in metadata', !!(c.metadata && c.metadata.revokedAt))
    await verify('public verify page says revoked', 'revoked')
    const p = await L.session(browser, S.att1)
    const mine = await L.api(p, 'GET', '/api/users/me/certificates')
    const row = mine.json && (mine.json.data || []).find((x) => x.id === c1.id)
    T.ok('attendee dashboard data marks it revoked', row && row.state === 'revoked', row && { status: row.status, state: row.state })
    const dl = await L.api(p, 'GET', `/api/certificates/${c1.id}/download`)
    T.ok('attendee can no longer download a revoked certificate (410)', dl.status === 410, dl.status)
    await L.closeSession(p)
    T.ok('audit: revoke (CANCEL)', !!(await db.auditLog.findFirst({ where: { entityId: c1.id, action: 'CANCEL' } })))
  })

  await T.step('restore', async () => {
    await openMenu('Restore')
    const toast = await L.waitToast(org)
    T.ok('"Certificate restored" toast', toast && /restored/i.test(toast.text), toast)
    await verify('public verify page says Valid again', 'valid')
  })

  await T.step('email to recipient (resend)', async () => {
    await L.clearToasts(org)
    await openMenu('Email to recipient')
    const toast = await L.waitToast(org, 20000)
    T.info(`resend toast: ${toast && toast.type}: ${toast && toast.text}`)
    T.ok('resend answers (success, or the handled "email couldn\'t be sent" without SMTP)', toast && (/sent/i.test(toast.text) || /couldn.t be sent/i.test(toast.text)), toast)
    const n = await db.notification.findFirst({ where: { userId: S.att1.id, category: 'CERTIFICATE' } })
    T.info(`certificate notification for the attendee: ${n ? 'yes' : 'no (only created after a successful email)'}`)
  })

  await T.step('certificate KPIs match the DB', async () => {
    await L.goto(org, '/admin/org/certificates')
    await L.sleep(1500)
    const txt = await L.bodyText(org)
    const m = txt.match(/Issued\s*(\d+)[\s\S]*?Revoked\s*(\d+)/)
    const total = await db.certificate.count({ where: { event: { organizationId: orgId } } })
    T.ok('Issued KPI = certificates of the org in the DB', m && +m[1] === total, { kpi: m && m.slice(1), db: total })
  })
  await L.closeSession(org)
})
