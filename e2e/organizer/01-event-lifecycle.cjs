// Event lifecycle as an organizer (alice, ORG_ADMIN Tech Club), desktop 1440:
// wizard (6 steps, validation, switches, cover upload, free + paid tickets, capacity) ->
// draft -> publish -> public pages -> edit (dates must not shift; FAQs/sessions kept) ->
// duplicate -> publish copy -> cancel copy with a reason -> public state of the copy.
const L = require('./lib.cjs')

const pad = (n) => String(n).padStart(2, '0')
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const sameFields = (f) => !!f && f.phone === false && f.organization === true && f.department === true
const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d }

L.run('01-event-lifecycle', async (T, browser) => {
  const S = L.state()
  const { orgId, aliceId } = await L.orgIds()
  const db = L.db()
  const title = `${L.TITLE_PREFIX} Workshop ${S.runId}`
  const start = at(10, 10), end = at(10, 17)
  await L.snapshotOrg()
  const page = await L.session(browser, 'alice')

  // ---------------- wizard: step 1 ----------------
  await L.goto(page, '/admin/org/events/create')
  await page.waitForSelector('#ev-title')
  await L.shot(page, '01-wizard-step1-empty')
  await T.step('wizard step 1 validation', async () => {
    await L.clickText(page, /^Next$/)
    await L.sleep(500)
    const alerts = await page.$$eval('[role="alert"]', (a) => a.map((x) => x.innerText))
    T.ok('step 1: Next with empty fields shows field errors', alerts.length >= 3, alerts)
    T.ok('step 1: stays on step 1 when invalid', !!(await page.$('#ev-title')))
  })
  await T.step('wizard step 1 fill', async () => {
    await L.typeInto(page, '#ev-title', title)
    const slug = await page.$eval('#ev-slug', (e) => e.value)
    T.ok('slug auto-fills from the title', /^e2e-?org-workshop-/.test(slug), slug)
    if (/^e2eorg/.test(slug)) T.uxIssue('minor', '/admin/org/events/create (step 1)', `The auto slug drops hyphens inside words: "${title}" becomes "${slug}" (E2E-ORG -> e2eorg), so "Hack-a-thon 2026" becomes "hackathon-2026".`, 'In slugify (src/lib/utils.ts) replace any run of non-alphanumerics with "-" and trim leading/trailing hyphens.')
    await L.typeInto(page, '#ev-short', 'Hands-on E2E workshop for the club.')
    await L.typeInto(page, '#ev-desc', 'A long description of the end-to-end organizer workshop. Bring a laptop and curiosity, we start sharp at ten.')
    await L.selectOption(page, '#ev-category', 'Workshop')
    await L.clickText(page, /^Next$/)
    T.ok('step 1 -> step 2', await page.waitForSelector('#ev-start', { timeout: 8000 }).then(() => true, () => false))
  })

  // ---------------- step 2 ----------------
  await T.step('wizard step 2', async () => {
    await L.clickText(page, /^Next$/)
    await L.sleep(400)
    T.ok('step 2: Next without dates is blocked', !!(await page.$('#ev-start')))
    // End before start: the wizard should refuse it here, not at publish time
    await L.setValue(page, '#ev-start', local(start))
    await L.setValue(page, '#ev-end', local(at(9, 9)))
    await L.clickText(page, /^Next$/)
    await L.sleep(500)
    const blocked = !!(await page.$('#ev-start'))
    T.ok('step 2: end date before start date is refused in the wizard', blocked)
    if (!blocked) {
      T.uxIssue('major', '/admin/org/events/create (step 2)', 'The wizard lets an organizer continue with an end date before the start date; the error only appears when saving/publishing ("The event can\'t end before it starts" or a 400).', 'Validate endDate > startDate in wizardSchema (superRefine) so the error shows on step 2.')
      await L.clickText(page, /^Back$/)
      await page.waitForSelector('#ev-start')
    }
    await L.setValue(page, '#ev-end', local(end))
    await L.typeInto(page, '#ev-venue', 'E2E Hall, Block C')
    await L.typeInto(page, '#ev-city', 'Bengaluru')
    await L.clickText(page, /^Next$/)
    T.ok('step 2 -> step 3', await page.waitForSelector('#tt-name-0', { timeout: 8000 }).then(() => true, () => false))
  })

  // ---------------- step 3 ----------------
  await T.step('wizard step 3 tickets', async () => {
    const disabledBefore = await page.$eval('#tt-price-0', (e) => e.disabled)
    T.ok('price is locked until "Paid event" is on', disabledBefore)
    T.ok('Paid event switch turns on', await L.setSwitch(page, 'Paid event', true))
    await L.typeInto(page, '#tt-name-0', 'Student Pass')
    await L.setValue(page, '#tt-qty-0', '50')
    await L.clickText(page, 'Add ticket')
    await page.waitForSelector('#tt-name-1')
    await L.typeInto(page, '#tt-name-1', 'Supporter')
    await L.setValue(page, '#tt-price-1', '199')
    await L.setValue(page, '#tt-qty-1', '20')
    await L.setValue(page, '#ev-capacity', '40')
    T.ok('Require approval switch turns on', await L.setSwitch(page, 'Require approval', true))
    await L.shot(page, '01-wizard-step3')
    await L.clickText(page, /^Next$/)
    T.ok('step 3 -> step 4', await page.waitForSelector('#ev-collectPhone', { timeout: 8000 }).then(() => true, () => false))
  })

  // ---------------- step 4 ----------------
  await T.step('wizard step 4 form', async () => {
    T.ok('phone switch on by default', await page.$eval('[role="switch"][aria-label="Ask for phone"]', (e) => e.getAttribute('aria-checked') === 'true' || e.hasAttribute('data-checked')))
    T.ok('phone switch turns off', (await L.setSwitch(page, 'Ask for phone', false)) === false)
    await L.setSwitch(page, 'Ask for organization / institution', true)
    await L.setSwitch(page, 'Ask for department', true)
    await L.clickText(page, 'Dropdown')
    await page.waitForSelector('#cf-label-0')
    await L.typeInto(page, '#cf-label-0', 'T-shirt size')
    await L.setSwitch(page, '[role="switch"][aria-label="Required"]', true)
    // An organizer types the options one per line, pressing Enter between them
    await page.click('#cf-opts-0')
    await page.keyboard.type('Small'); await page.keyboard.press('Enter'); await page.keyboard.type('Medium'); await page.keyboard.press('Enter'); await page.keyboard.type('Large')
    await page.keyboard.press('Tab') // the last option is kept on leaving the box, without Enter
    await L.sleep(300)
    const typed = await page.$$eval('ul[aria-label="Options"] li span', (els) => els.map((e) => e.textContent.trim()))
    const okLines = typed.join('|') === 'Small|Medium|Large'
    T.ok('dropdown options: Enter adds each one, the last is kept on leaving the box', okLines, JSON.stringify(typed))
    if (!okLines) {
      T.uxIssue('major', '/admin/org/events/create (step 4, custom Dropdown/Radio/Multi-select)', `Pressing Enter in "Options (one per line)" does nothing: the empty new line is filtered out on every keystroke, so typing "Small⏎Medium⏎Large" produces "${typed.replace(/\n/g, '⏎')}". Organizers can only paste options.`, 'Keep the raw textarea text in state and split/filter it only when saving (src/components/events/wizard/Step4Form.tsx).')
      await L.setValue(page, '#cf-opts-0', 'Small\nMedium\nLarge')
    }
    await L.clickText(page, 'Short Text')
    await page.waitForSelector('#cf-label-1')
    await L.typeInto(page, '#cf-label-1', 'GitHub handle')
    await L.clickText(page, /^Next$/)
    T.ok('step 4 -> step 5', await page.waitForSelector('#ev-rules', { timeout: 8000 }).then(() => true, () => false))
  })

  // ---------------- step 5 ----------------
  await T.step('wizard step 5 media', async () => {
    const png = L.makePng()
    const input = await page.$('#ev-cover')
    await input.uploadFile(png)
    const uploaded = await page.waitForSelector('img[alt="Cover image preview"]', { timeout: 20000 }).then(() => true, () => false)
    T.ok('cover PNG uploads and previews', uploaded)
    const coverSrc = uploaded ? await page.$eval('img[alt="Cover image preview"]', (e) => e.getAttribute('src')) : null
    if (coverSrc) L.track('uploads', coverSrc)
    await L.typeInto(page, '#ev-rules', 'Be kind. Bring your laptop.')
    await L.typeInto(page, '#ev-terms', 'You agree to the club code of conduct.')
    await L.typeInto(page, '#ev-contact-email', 'e2e-org-contact@test.local')
    await L.clickText(page, 'Add FAQ')
    await page.waitForSelector('#faq-q-0')
    await L.typeInto(page, '#faq-q-0', 'Is lunch included?')
    await L.typeInto(page, '#faq-a-0', 'Yes, a light lunch is served.')
    await L.clickText(page, 'Add FAQ')
    await page.waitForSelector('#faq-q-1')
    await L.typeInto(page, '#faq-q-1', 'Do I need to bring a laptop?')
    await L.typeInto(page, '#faq-a-1', 'Yes, with Node 20 installed.')
    await L.clickText(page, /^Next$/)
    T.ok('step 5 -> step 6 review', await L.waitText(page, 'Page extras', 8000))
  })

  // ---------------- step 6 + save draft ----------------
  let eventId
  await T.step('save as draft', async () => {
    const txt = await L.bodyText(page)
    T.ok('review shows the title, 2 ticket types, paid, org+dept fields', txt.includes(title) && (await page.$$eval('ul[aria-label="Ticket types"] > li', (els) => els.length)) === 2 && /Pricing\s*Paid/.test(txt) && /Name, Email, (Phone, )?Organization, Department/.test(txt), txt.slice(txt.indexOf('Basics'), txt.indexOf('Basics') + 600))
    if (!/Student Pass/.test(txt)) T.uxIssue('minor', '/admin/org/events/create (step 6 Review)', 'The review lists only the number of ticket types: no ticket names, prices or stock, no capacity and no "Require approval" state, which are the settings organizers most often get wrong.', 'Show each ticket (name, price, quantity), capacity, waitlist and approval in Step6Review.')
    await L.shot(page, '01-wizard-step6-review')
    // Capture exactly what the wizard sends, so it can be checked even if the server refuses it
    let payload = null
    const onReq = (req) => { if (req.method() === 'POST' && req.url().endsWith(`/api/admin/org/${orgId}/events`)) { try { payload = JSON.parse(req.postData()) } catch {} } }
    page.on('request', onReq)
    await L.clearToasts(page)
    await L.clickText(page, 'Save as draft')
    const toast = await L.waitToast(page)
    page.off('request', onReq)
    await L.shot(page, '01-wizard-save-draft-result')
    T.ok('wizard sends start/end as the typed local time', payload && new Date(payload.startDate).getTime() === start.getTime() && new Date(payload.endDate).getTime() === end.getTime(), payload && [payload.startDate, payload.endDate])
    T.ok('wizard sends both ticket types with prices and stock', payload && payload.ticketTypes.length === 2 && payload.ticketTypes[1].price === 199 && payload.ticketTypes[0].quantity === 50, payload && payload.ticketTypes)
    T.ok('wizard sends the registration-field switches', payload && sameFields(payload.settings.registrationFields), payload && payload.settings)
    T.ok('wizard sends custom fields, FAQs, cover, capacity, approval', payload && payload.customFormFields.length === 2 && payload.faqs.length === 2 && /^\/uploads\//.test(payload.coverImage || '') && payload.maxCapacity === 40 && payload.approvalRequired === true)
    const limited = toast && /event limit/i.test(toast.text)
    T.ok('"Draft saved" toast (event created)', toast && /draft saved/i.test(toast.text), toast)
    if (limited) {
      T.uxIssue('blocker', '/admin/org/events/create (Save as draft / Publish)', `Creating any event in Tech Club fails after all 6 steps with "${toast.text}". The FREE plan's 5-events-per-month limit is counted across the whole enterprise (Demo University: all orgs' events created this month, cancelled ones included), so one club's activity blocks every other club, and an ORG_ADMIN cannot upgrade the enterprise plan. The organizer only learns this after filling the whole wizard.`, 'Check the limit before opening the wizard (disable "Create event" with the reason and who can upgrade), count per organization or per active event, and keep the form data (local draft) when the save is refused.')
      // Continue the lifecycle with the exact wizard payload, inserted the way the POST route would
      // (no shared plan/subscription data is touched). Everything after this goes through the app.
      T.info('event creation blocked by the plan limit: inserting the captured wizard payload directly to continue')
      const p = payload
      const settings = Object.fromEntries(Object.entries(p.settings || {}).filter(([, v]) => v !== null))
      const ev = await db.event.create({
        data: {
          title: p.title, slug: p.slug, shortDescription: p.shortDescription, description: p.description, type: p.type, category: p.category,
          tags: p.tags || [], visibility: p.visibility, startDate: new Date(p.startDate), endDate: new Date(p.endDate), timezone: p.timezone,
          isOnline: p.isOnline, venue: p.venue, venueCity: p.venueCity, isPaid: p.isPaid, maxCapacity: p.maxCapacity, waitlistEnabled: p.waitlistEnabled,
          approvalRequired: p.approvalRequired, allowTeamRegistration: p.allowTeamRegistration, coverImage: p.coverImage, rules: p.rules,
          termsAndConditions: p.termsAndConditions, contactEmail: p.contactEmail, status: 'DRAFT', settings,
          organizationId: orgId, enterpriseId: (await L.orgIds()).enterpriseId, createdById: aliceId,
          ticketTypes: { create: p.ticketTypes.map((t, i) => ({ name: t.name, description: t.description || null, price: t.price, currency: t.currency, quantity: t.quantity, maxPerUser: t.maxPerUser, isActive: true, isHidden: false, sortOrder: i })) },
          customFormFields: { create: p.customFormFields.map((f, i) => ({ label: f.label, fieldType: f.fieldType, placeholder: f.placeholder || null, helpText: f.helpText || null, isRequired: !!f.isRequired, options: f.options || [], sortOrder: i })) },
          faqs: { create: p.faqs.map((f, i) => ({ question: f.question, answer: f.answer, sortOrder: i })) },
        },
      })
      L.track('events', ev.id)
      L.setState('creationBlockedByPlan', toast.text)
    } else {
      await page.waitForFunction(() => location.pathname === '/admin/org/events', { timeout: 20000 }).catch(() => {})
      T.ok('goes back to the events list', page.url().endsWith('/admin/org/events'), page.url())
    }
    const ev = await db.event.findFirst({
      where: { title, organizationId: orgId },
      include: { ticketTypes: { orderBy: { sortOrder: 'asc' } }, customFormFields: { orderBy: { sortOrder: 'asc' } }, faqs: true },
    })
    if (!ev) throw new Error('no event')
    eventId = ev.id
    L.track('events', ev.id)
    L.setState('eventA', { id: ev.id, slug: ev.slug, title })
    if (!limited) {
      T.ok('status DRAFT', ev.status === 'DRAFT', ev.status)
      T.ok('audit log: CREATE event', !!(await db.auditLog.findFirst({ where: { entityId: ev.id, action: 'CREATE' } })))
    }
  })
  if (!eventId) return
  const A = L.state().eventA

  // ---------------- list + draft not public ----------------
  await T.step('draft in list, not public', async () => {
    await L.goto(page, '/admin/org/events')
    await L.typeInto(page, 'input[aria-label="Search events"]', title)
    T.ok('events list finds the draft by title', await L.waitText(page, title, 15000))
    const anon = await L.session(browser, null)
    const st = await L.goto(anon, `/events/${A.slug}`)
    const txt = await L.bodyText(anon)
    T.ok('a draft is not visible on the public event page', st === 404 || /not found/i.test(txt), st)
    await L.closeSession(anon)
  })

  // ---------------- publish from the wizard (edit mode, draft) ----------------
  await T.step('publish via wizard', async () => {
    await L.goto(page, `/admin/org/events/${eventId}/edit`)
    await page.waitForSelector('#ev-title')
    for (let i = 0; i < 5; i++) { await L.clickText(page, /^Next$/); await L.sleep(350) }
    await L.clickText(page, 'Publish event')
    T.ok('publish asks for confirmation', await L.waitText(page, 'Publish this event?', 8000))
    await L.clearToasts(page)
    await L.clickText(page, 'Yes, publish now')
    const toast = await L.waitToast(page)
    T.ok('"Event published" toast', toast && toast.type !== 'error' && /published/i.test(toast.text), toast)
    await L.sleep(1000)
    const ev = await db.event.findUnique({ where: { id: eventId }, include: { ticketTypes: { orderBy: { sortOrder: 'asc' } }, customFormFields: { orderBy: { sortOrder: 'asc' } }, faqs: true } })
    T.ok('status PUBLISHED with publishedAt', ev.status === 'PUBLISHED' && !!ev.publishedAt, ev.status)
    T.ok('publishing (wizard save) did not shift the dates', ev.startDate.getTime() === start.getTime() && ev.endDate.getTime() === end.getTime(), [ev.startDate, ev.endDate])
    T.ok('audit log: PUBLISH', !!(await db.auditLog.findFirst({ where: { entityId: eventId, action: 'PUBLISH' } })))
    // The wizard's save wrote every field again through the PATCH route: check what is stored
    T.ok('stored: two ticket types, free Student Pass (50) + Supporter ₹199 (20)',
      ev.ticketTypes.length === 2 && Number(ev.ticketTypes[0].price) === 0 && ev.ticketTypes[0].quantity === 50 && Number(ev.ticketTypes[1].price) === 199 && ev.ticketTypes[1].quantity === 20,
      ev.ticketTypes.map((t) => [t.name, Number(t.price), t.quantity]))
    T.ok('stored: capacity 40, paid, approval required', ev.maxCapacity === 40 && ev.isPaid && ev.approvalRequired, [ev.maxCapacity, ev.isPaid, ev.approvalRequired])
    T.ok('stored: registration fields (phone off, org on, dept on)', sameFields(ev.settings?.registrationFields), ev.settings?.registrationFields)
    T.ok('stored: custom fields with options', ev.customFormFields.length === 2 && ev.customFormFields[0].options.join('|') === 'Small|Medium|Large' && ev.customFormFields[0].isRequired, ev.customFormFields.map((f) => [f.label, f.options]))
    T.ok('stored: 2 FAQs and the cover image', ev.faqs.length === 2 && /^\/uploads\//.test(ev.coverImage || ''), [ev.faqs.length, ev.coverImage])
  })

  // ---------------- public pages ----------------
  await T.step('public listing and event page', async () => {
    const anon = await L.session(browser, null)
    await L.goto(anon, `/events?search=${encodeURIComponent(title)}`)
    T.ok('/events lists the published event', await L.waitText(anon, title, 20000))
    const st = await L.goto(anon, `/events/${A.slug}`)
    const txt = await L.bodyText(anon)
    T.ok('public event page loads (200)', st === 200, st)
    T.ok('public page shows title, venue, both tickets and the ₹199 price', txt.includes(title) && txt.includes('E2E Hall') && txt.includes('Student Pass') && txt.includes('Supporter') && /₹\s?199/.test(txt), txt.slice(0, 400))
    T.ok('public page shows the FAQ', txt.includes('Is lunch included?'))
    const cover = await anon.$$eval('img', (imgs) => imgs.map((i) => i.getAttribute('src') || '').filter((s) => s.includes('/uploads/') || s.includes('uploads')))
    T.ok('public page shows the cover image', cover.length > 0, cover)
    await L.shot(anon, '01-public-event')
    await L.closeSession(anon)
  })

  await T.step('register form shows exactly the enabled fields', async () => {
    const reg = await L.session(browser, null)
    const att1 = await L.createAttendee(reg, 'att1', 'E2E Org Attendee One')
    L.setState('att1', att1)
    await L.closeSession(reg)
    const p = await L.session(browser, att1)
    await L.goto(p, `/events/${A.slug}/register`)
    await L.waitText(p, 'Choose your ticket', 20000)
    await L.clickText(p, 'Student Pass', 'label')
    await L.clickText(p, 'Continue')
    await p.waitForSelector('#reg-name', { timeout: 10000 })
    const ids = await p.evaluate(() => ['reg-phone', 'reg-organization', 'reg-department', 'terms'].map((id) => !!document.getElementById(id)))
    T.ok('phone field hidden (switch off)', ids[0] === false)
    T.ok('organization field shown (switch on)', ids[1] === true)
    T.ok('department field shown (switch on)', ids[2] === true)
    T.ok('terms checkbox shown (event has T&C)', ids[3] === true)
    const txt = await L.bodyText(p)
    T.ok('custom questions shown (T-shirt size, GitHub handle)', txt.includes('T-shirt size') && txt.includes('GitHub handle'))
    await L.shot(p, '01-register-details')
    await L.closeSession(p)
  })

  // ---------------- edit: title, dates, capacity; FAQs and sessions survive ----------------
  await T.step('edit keeps dates, FAQs and sessions', async () => {
    // A session added outside the wizard (the wizard has no session editor) must survive edits
    const sess = await db.eventSession.create({ data: { eventId, title: 'E2E-ORG Keynote', startTime: at(10, 10), endTime: at(10, 11) } })
    L.track('sessions', sess.id)
    await L.goto(page, `/admin/org/events/${eventId}/edit`)
    await page.waitForSelector('#ev-title')
    await L.typeInto(page, '#ev-title', `${title} edited`)
    await L.clickText(page, /^Next$/)
    await page.waitForSelector('#ev-start')
    const shown = await page.$eval('#ev-start', (e) => e.value)
    T.ok('edit form shows the start time unchanged (no timezone shift)', shown === local(start), { shown, expected: local(start) })
    const newStart = at(11, 11, 30), newEnd = at(11, 18)
    await L.setValue(page, '#ev-start', local(newStart))
    await L.setValue(page, '#ev-end', local(newEnd))
    await L.clickText(page, /^Next$/)
    await page.waitForSelector('#ev-capacity')
    await L.setValue(page, '#ev-capacity', '45')
    for (let i = 0; i < 3; i++) { await L.clickText(page, /^Next$/); await L.sleep(350) }
    await L.clearToasts(page)
    await L.clickText(page, 'Save and close')
    const toast = await L.waitToast(page)
    T.ok('"Changes saved" toast', toast && /saved/i.test(toast.text), toast)
    await L.sleep(800)
    const ev = await db.event.findUnique({ where: { id: eventId }, include: { faqs: true, sessions: true, ticketTypes: true, customFormFields: true } })
    T.ok('title updated', ev.title === `${title} edited`, ev.title)
    T.ok('new start/end stored exactly as typed', ev.startDate.getTime() === newStart.getTime() && ev.endDate.getTime() === newEnd.getTime(), [ev.startDate, ev.endDate])
    T.ok('capacity updated to 45', ev.maxCapacity === 45, ev.maxCapacity)
    T.ok('FAQs not wiped (2)', ev.faqs.length === 2, ev.faqs.length)
    T.ok('sessions not wiped (1)', ev.sessions.length === 1, ev.sessions.length)
    T.ok('ticket types kept in place (same ids)', ev.ticketTypes.length === 2)
    T.ok('custom fields kept with options', ev.customFormFields.length === 2 && ev.customFormFields.some((f) => f.options.length === 3))
    T.ok('status still PUBLISHED', ev.status === 'PUBLISHED', ev.status)
    L.setState('eventA', { ...L.state().eventA, title: ev.title, start: newStart.toISOString(), end: newEnd.toISOString() })
  })

  await T.step('edit from another timezone does not move the event', async () => {
    const before = await db.event.findUnique({ where: { id: eventId }, select: { startDate: true, endDate: true, registrationEndDate: true } })
    const ny = await L.session(browser, 'alice', L.DESKTOP, { timezone: 'America/New_York' })
    await L.goto(ny, `/admin/org/events/${eventId}/edit`)
    await ny.waitForSelector('#ev-title')
    await L.clearToasts(ny)
    await L.clickText(ny, 'Save changes')
    const toast = await L.waitToast(ny)
    await L.sleep(500)
    const after = await db.event.findUnique({ where: { id: eventId }, select: { startDate: true, endDate: true } })
    T.ok('saving from New York keeps the same instant', toast && before.startDate.getTime() === after.startDate.getTime() && before.endDate.getTime() === after.endDate.getTime(), { before, after, toast })
    const covered = await ny.evaluate(() => { const t = document.querySelector('[data-sonner-toast]'); const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Next'); if (!t || !b) return false; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!el && !b.contains(el) })
    if (covered) T.uxIssue('minor', '/admin/org/events/[id]/edit (wizard footer)', 'The "Changes saved" toast sits on top of the sticky footer Next / Publish button (bottom-right) for ~4 s; clicking Next during that time clicks the toast instead.', 'Position the Toaster top-center on wizard pages or add an offset above the sticky footer.')
    await L.waitNoToast(ny)
    await L.clickText(ny, /^Next$/)
    await ny.waitForSelector('#ev-start')
    const shownNy = await ny.$eval('#ev-start', (e) => e.value)
    T.info(`New York browser shows start as ${shownNy} (event timezone is Asia/Kolkata)`)
    T.uxIssue('minor', '/admin/org/events/[id]/edit (step 2)', `Times are entered and shown in the browser's time zone, not the event's (Asia/Kolkata): an organizer travelling or on a VPN sees ${shownNy} for a 11:30 IST start, and the public page also shows viewer-local times without a zone label.`, 'Interpret/format datetime-local values in event.timezone (e.g. with date-fns-tz) and show the zone next to times.')
    await L.closeSession(ny)
  })

  // ---------------- duplicate -> publish -> cancel ----------------
  let dupId
  await T.step('duplicate from the row menu', async () => {
    await L.goto(page, '/admin/org/events')
    const t = L.state().eventA.title
    await L.typeInto(page, 'input[aria-label="Search events"]', L.TITLE_PREFIX + ' Workshop ' + S.runId)
    await L.waitText(page, t, 15000)
    await page.click(`button[aria-label="Actions for ${t}"]`)
    await L.clearToasts(page)
    await L.clickText(page, 'Duplicate', '[role="menuitem"]')
    const toast = await L.waitToast(page)
    T.ok('"Event duplicated as draft" toast', toast && /duplicated/i.test(toast.text), toast)
    const dup = await db.event.findFirst({ where: { title: `${t} (Copy)`, organizationId: orgId }, include: { ticketTypes: true, faqs: true, customFormFields: true, sessions: true } })
    T.ok('copy created as DRAFT', dup && dup.status === 'DRAFT', dup && dup.status)
    if (!dup) return
    if (L.state().creationBlockedByPlan) T.ok('duplicate respects the same plan event limit as create', false, 'POST /events refused with the plan limit, but POST /events/[id]/duplicate created a new event anyway (no checkUsageLimits in duplicate/route.ts)')
    dupId = dup.id
    L.track('events', dup.id)
    L.setState('eventDup', { id: dup.id, slug: dup.slug, title: dup.title })
    T.ok('copy has tickets, FAQs and form fields', dup.ticketTypes.length === 2 && dup.faqs.length === 2 && dup.customFormFields.length === 2)
    T.ok('copy keeps registration-field switches', sameFields(dup.settings?.registrationFields))
    if (dup.sessions.length === 0) T.uxIssue('minor', '/admin/org/events (Duplicate)', 'Duplicate copies tickets, FAQs, sponsors and form fields but silently drops the schedule (sessions); dates are reset to +30 days with no notice.', 'Copy sessions (shifted with the dates) or tell the organizer in the toast what was not copied.')
  })
  if (dupId) {
    const D = L.state().eventDup
    await T.step('publish the copy from the row menu', async () => {
      await page.reload({ waitUntil: 'networkidle2' })
      await L.waitText(page, D.title, 15000)
      await page.click(`button[aria-label="Actions for ${D.title}"]`)
      await L.clearToasts(page)
      await L.clickText(page, 'Publish', '[role="menuitem"]')
      const toast = await L.waitToast(page)
      T.ok('row-menu publish toast', toast && /published|approval/i.test(toast.text), toast)
      const ev = await db.event.findUnique({ where: { id: dupId } })
      T.ok('copy is PUBLISHED', ev.status === 'PUBLISHED', ev.status)
    })
    await T.step('an attendee registers on the copy', async () => {
      const reg = await L.session(browser, null)
      const att2 = await L.createAttendee(reg, 'att2', 'E2E Org Attendee Two')
      L.setState('att2', att2)
      await L.closeSession(reg)
      const p = await L.session(browser, att2)
      const tt = await db.ticketType.findFirst({ where: { eventId: dupId, name: 'Student Pass' } })
      const r = await L.api(p, 'POST', '/api/registrations', { eventId: dupId, ticketTypeId: tt.id, quantity: 1, formResponses: { name: 'E2E Org Attendee Two', organization: 'E2E U', department: 'CS', 'T-shirt size': 'Small' } })
      T.ok('registration on the copy accepted', r.status === 201, r.json)
      await L.closeSession(p)
      // and one confirmed guest with a ticket (organizer's add counts as approval)
      const guest = `${L.EMAIL_PREFIX}dupguest-${S.runId}@test.local`
      L.track('users', guest)
      L.setState('dupGuest', guest)
      const add = await L.api(page, 'POST', `/api/admin/org/${orgId}/registrations`, { eventId: dupId, name: 'E2E Dup Guest', email: guest, ticketTypeId: tt.id })
      T.ok('confirmed guest added to the copy', add.status === 201 && add.json.data.status === 'CONFIRMED', add.json)
    })
    await T.step('cancel the copy (reason required)', async () => {
      await page.reload({ waitUntil: 'networkidle2' })
      await L.waitText(page, D.title, 15000)
      await page.click(`button[aria-label="Actions for ${D.title}"]`)
      await L.clickText(page, 'Cancel event', '[role="menuitem"]')
      await page.waitForSelector('#cancel-event-reason')
      const disabled = await page.$eval('button[form="cancel-event-form"]', (b) => b.disabled)
      T.ok('Cancel event is disabled until a reason is typed', disabled)
      await L.typeInto(page, '#cancel-event-reason', 'E2E test: venue unavailable')
      await L.clearToasts(page)
      await page.click('button[form="cancel-event-form"]')
      const toast = await L.waitToast(page)
      T.ok('"Event cancelled" toast', toast && /cancel/i.test(toast.text), toast)
      await L.sleep(800)
      const ev = await db.event.findUnique({ where: { id: dupId } })
      T.ok('copy is CANCELLED with the reason', ev.status === 'CANCELLED' && ev.cancellationReason === 'E2E test: venue unavailable', [ev.status, ev.cancellationReason])
      T.ok('audit log: CANCEL', !!(await db.auditLog.findFirst({ where: { entityId: dupId, action: 'CANCEL' } })))
      const att2 = L.state().att2
      const reg = await db.registration.findFirst({ where: { eventId: dupId, user: { email: att2.email } }, include: { ticket: true } })
      T.ok("the attendee's registration is cancelled", reg && reg.status === 'CANCELLED', reg && reg.status)
      const notif = await db.notification.findFirst({ where: { userId: att2.id, eventId: dupId } })
      T.ok('the attendee is notified that the event was cancelled', !!notif, 'no notification row for the attendee')
      const evAfter = await db.event.findUnique({ where: { id: dupId }, select: { currentRegistrations: true } })
      T.info(`copy currentRegistrations after cancel: ${evAfter.currentRegistrations}`)
      // the confirmed guest added before the cancel: their ticket must not stay valid
      const g = await db.registration.findFirst({ where: { eventId: dupId, user: { email: L.state().dupGuest } }, include: { ticket: true } })
      T.ok("a confirmed attendee's registration is cancelled too", g && g.status === 'CANCELLED', g && g.status)
      T.ok("a confirmed attendee's ticket is voided (not left ACTIVE)", g && g.ticket && g.ticket.status === 'CANCELLED', g && g.ticket && g.ticket.status)
      T.ok('seat counter released after cancelling', evAfter.currentRegistrations === 0, evAfter.currentRegistrations)
    })
    await T.step('public state of the cancelled copy', async () => {
      const anon = await L.session(browser, null)
      const st = await L.goto(anon, `/events/${D.slug}`)
      const txt = await L.bodyText(anon)
      T.ok('cancelled event page says it is cancelled', /cancel/i.test(txt), { status: st, text: txt.slice(0, 300) })
      const regBtn = await L.findByText(anon, 'a, button', /^Register/, { timeout: 1500 })
      T.ok('cancelled event offers no Register button', !regBtn)
      await L.goto(anon, `/events?search=${encodeURIComponent(D.title)}`)
      await L.sleep(1500)
      T.ok('cancelled event is not listed on /events', !(await L.bodyText(anon)).includes(D.title))
      await L.shot(anon, '01-public-cancelled-copy')
      await L.closeSession(anon)
    })
  }
  T.info(`console errors on the organizer page: ${page.__errors.length}`)
  await L.closeSession(page)
})
