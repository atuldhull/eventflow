// Platform settings (/super-admin/settings) end to end. These settings are GLOBAL, so every
// change is verified within seconds and the ORIGINAL document is restored in `finally`
// (a backup is also written to out/settings-backup.json; cleanup.cjs restores it if this
// script is killed half-way).
// Usage: node e2e/platform/03-platform-settings.cjs
'use strict'
const fs = require('fs')
const path = require('path')
const L = require('./lib.cjs')
const { db, PREFIX, NAME_PREFIX } = L

const t = L.makeT('03-platform-settings')
const run = L.runId()
const anon = new L.Client('anon')
const BACKUP = path.join(L.OUT, 'settings-backup.json')
const KEY = 'platform:settings'

async function poll(fn, ok, { timeout = 40000, every = 1500 } = {}) {
  const t0 = Date.now()
  let last
  while (Date.now() - t0 < timeout) {
    last = await fn()
    if (ok(last)) return { hit: true, value: last, ms: Date.now() - t0 }
    await L.sleep(every)
  }
  return { hit: false, value: last, ms: Date.now() - t0 }
}

let admin, orig, rowExisted, startedAt

async function saveWith(mut) {
  const s = structuredClone(orig)
  mut(s)
  const r = await admin.post('/api/super-admin/settings', s)
  if (r.status !== 200) throw new Error(`settings save failed: ${r.status} ${JSON.stringify(r.body)}`)
  return r
}

async function restore() {
  const r = await admin.post('/api/super-admin/settings', orig)
  const back = await admin.get('/api/super-admin/settings')
  const same = JSON.stringify(back.body.data.settings) === JSON.stringify(orig)
  if (!rowExisted && same) await db().featureModuleData.deleteMany({ where: { uniqueKey: KEY } })
  return r.status === 200 && same
}

async function main() {
  if (!(await L.serverUp())) throw new Error('dev server not responding on ' + L.BASE)
  const p = db()
  admin = await L.loginAs('admin')
  startedAt = new Date()

  t.section('Read + validation (no changes)')
  const g = await admin.get('/api/super-admin/settings')
  t.ok('settings load (5 sections + email transport)', g.status === 200 && ['general', 'features', 'email', 'security', 'maintenance'].every((k) => g.body.data.settings[k]) && !!g.body.data.emailTransport, g.status)
  orig = g.body.data.settings
  rowExisted = !!(await p.featureModuleData.findUnique({ where: { uniqueKey: KEY } }))
  fs.writeFileSync(BACKUP, JSON.stringify({ settings: orig, rowExisted, at: new Date().toISOString() }, null, 2))
  console.log(`original settings saved to ${BACKUP} (row existed: ${rowExisted})`)
  const bad1 = await admin.post('/api/super-admin/settings', { ...orig, security: { ...orig.security, minPasswordLength: 4 } })
  t.ok('min password length below 8 is refused (400)', bad1.status === 400, bad1.body)
  const bad2 = await admin.post('/api/super-admin/settings', { ...orig, general: { ...orig.general, platformName: '' } })
  t.ok('empty platform name is refused (400)', bad2.status === 400, bad2.body)
  const te = await admin.post('/api/super-admin/settings/test-email', {})
  // Whether or not a mail server is reachable, the answer must be the truth: "sent" only with a
  // message id from the mail server, otherwise a 502 with the sender's real error.
  const teSent = te.status === 200 && te.body.success === true && !!(te.body.data && te.body.data.messageId)
  const teFailed = te.status === 502 && te.body.success === false && te.body.message && !/sent to/i.test(te.body.message)
  t.ok('test email tells the truth (sent with a message id, or the real sender error)', teSent || teFailed, te.body)
  console.log(`   test-email said: ${te.body && te.body.message}`)
  const teAudit = await p.auditLog.findFirst({ where: { entityType: 'PLATFORM', entityId: 'test-email', createdAt: { gte: startedAt } } })
  t.ok('test email is audited with its outcome', teAudit && (teSent ? /sent/i.test(teAudit.description) : /failed/i.test(teAudit.description)), teAudit && teAudit.description)
  const teBad = await admin.post('/api/super-admin/settings/test-email', { to: 'not-an-email' })
  t.ok('test email to an invalid address is refused (400)', teBad.status === 400)

  // Fixtures for the payment check: a standalone club with an admin and an attendee
  const clubAdmin = await L.createUser(`ps-admin-${run}`)
  const attendee = await L.createUser(`ps-att-${run}`)
  const org = await p.organization.create({ data: { name: `${NAME_PREFIX} PS Club ${run}`, slug: `${PREFIX}ps-${run}`, email: `ps-${run}@example.edu`, members: { create: { userId: clubAdmin.id, role: 'ORG_ADMIN' } } } })
  const clubC = await L.loginEmail(clubAdmin.email)
  const attC = await L.loginEmail(attendee.email)

  try {
    // ── Registration off ─────────────────────────────────────────────────────
    t.section('User registration OFF')
    await saveWith((s) => { s.features.userRegistration = false })
    const off = await poll(() => anon.post('/api/auth/signup', {}), (r) => r.status === 403)
    t.ok('signup API refuses with 403 + clear message', off.hit && /turned off/i.test(off.value.body.message), off.value && off.value.body)
    console.log(`   took effect after ${off.ms} ms; message: "${off.value && off.value.body.message}"`)
    t.ok('the /signup page still loads (it cannot warn up front)', (await anon.get('/signup')).status === 200)
    t.note('With sign-ups off, /signup still shows the full form; the "New sign-ups are turned off" toast only appears after step 2 (name, email, password, phone) is submitted.')
    await saveWith(() => {})
    const on = await poll(() => anon.post('/api/auth/signup', {}), (r) => r.status === 400)
    t.ok('restored: signup API validates again (400 on an empty body)', on.hit, on.value && on.value.status)

    // ── Minimum password length ──────────────────────────────────────────────
    t.section('Minimum password length = 12')
    await saveWith((s) => { s.security.minPasswordLength = 12 })
    const cp = await clubC.post('/api/auth/change-password', { currentPassword: 'definitely-wrong', newPassword: 'Abcd@123456' })
    t.ok('change-password enforces 12 (11-char new password -> 400 "at least 12")', cp.status === 400 && /12/.test(cp.body.message || ''), cp.body)
    const su = await anon.post('/api/auth/signup', { name: 'E2E Ent Signup', email: `${PREFIX}signup-${run}@test.local`, password: 'Abcd@123456', confirmPassword: 'Abcd@123456', agreeToTerms: true })
    t.ok('signup enforces 12 (11-char password -> 400 "at least 12")', su.status === 400 && /12/.test(su.body.message || ''), su.body)
    t.note('Signup form validates passwords client-side against 8 characters only, so with a higher platform minimum the user finds out after step 2.')
    await saveWith(() => {})
    const cp2 = await clubC.post('/api/auth/change-password', { currentPassword: 'definitely-wrong', newPassword: 'Abcd@123456' })
    t.ok('restored: an 11-char password passes the length check again', cp2.status !== 400 || !/12/.test(cp2.body.message || ''), cp2.body)

    // ── Payments off ─────────────────────────────────────────────────────────
    t.section('Payment processing OFF')
    await saveWith((s) => { s.features.paymentProcessing = false })
    const paid = await clubC.post(`/api/admin/org/${org.id}/events`, L.eventBody(`${PREFIX}ps-paid-${run}`, `${NAME_PREFIX} Paid ${run}`, { status: 'PUBLISHED', paid: true }))
    t.ok('with payments off, a club cannot publish a PAID event', paid.status !== 201,
      `POST paid event -> ${paid.status}: the setting is only read by /api/payments/create-order, so paid events are still created and listed`)
    if (paid.status === 201) {
      const ev = paid.body.data
      const reg = await p.registration.create({ data: { registrationNumber: `E2E-${run}-PS`, eventId: ev.id, userId: attendee.id, ticketTypeId: ev.ticketTypes[0].id, status: 'PENDING' } })
      await p.payment.create({ data: { paymentNumber: `E2E-${run}-PSP`, registrationId: reg.id, userId: attendee.id, eventId: ev.id, amount: 499, status: 'PENDING', method: 'RAZORPAY' } })
      const co = await attC.post('/api/payments/create-order', { registrationId: reg.id })
      t.ok('create-order refuses (503)', co.status === 503, co.body)
      t.ok('buyer is told payments are turned off (not "not configured")', /turned off/i.test(co.body.message || ''),
        `"${co.body.message}": create-order checks the Razorpay keys before the platform switch, so with keys empty the switch is never what the buyer sees`)
    }
    await saveWith(() => {})

    // ── Social sign-in toggles ───────────────────────────────────────────────
    t.section('Google / Microsoft sign-in toggles')
    const prov1 = Object.keys((await anon.get('/api/auth/providers')).body || {})
    await saveWith((s) => { s.features.googleOAuth = !orig.features.googleOAuth; s.features.microsoftOAuth = !orig.features.microsoftOAuth })
    const prov2 = Object.keys((await anon.get('/api/auth/providers')).body || {})
    await saveWith(() => {})
    t.eq('providers offered to the login page are the same either way', prov2, prov1)
    t.note(`Social buttons follow only the OAuth env keys (providers now: ${prov1.join(', ')}). The Google/Microsoft toggles are checked only in the signIn callback, so once keys are set a switched-off provider still shows its button and fails with a generic error (SocialLoginButtons.tsx reads getProviders() only). Not verifiable end to end here: no OAuth keys locally.`)

    // ── Maintenance mode (last; shortest possible) ───────────────────────────
    t.section('Maintenance mode ON')
    const MSG = `E2E maintenance check ${run}: back in a minute`
    await saveWith((s) => { s.maintenance = { enabled: true, message: MSG } })
    const down = await poll(() => anon.get('/'), (r) => r.status === 503)
    t.ok('home page answers 503 (middleware cache <= 30 s)', down.hit, down.value && down.value.status)
    console.log(`   maintenance took effect after ${down.ms} ms`)
    if (down.hit) {
      const results = await Promise.all([
        anon.get('/'), anon.get('/api/events'), anon.get('/api/health'), anon.get('/login'), anon.get('/api/auth/csrf'), anon.get('/signup'), anon.get('/events'),
      ])
      const [home, apiEv, health, login, csrf, signup, events] = results
      t.ok('503 page shows the message + Retry-After', home.text.includes(MSG) && home.headers.get('retry-after') === '300', home.headers.get('retry-after'))
      t.ok('API answers 503 JSON {maintenance:true}', apiEv.status === 503 && apiEv.body.maintenance === true, apiEv.status)
      t.ok('/events is 503', events.status === 503)
      t.ok('/api/health stays up (200)', health.status === 200)
      t.ok('/login stays up (200)', login.status === 200, login.status)
      t.ok('/api/auth/csrf stays up (200)', csrf.status === 200)
      t.ok('/signup is blocked (503)', signup.status === 503, signup.status)
      const sa = await admin.get('/super-admin/settings')
      t.ok('super admin pages work (200)', sa.status === 200, sa.status)
      t.ok('super admin APIs work (200)', (await admin.get('/api/super-admin/settings')).status === 200)
      const al = await new L.Client('alice-m').login(...L.ACCOUNTS.alice)
      t.ok('credentials sign-in still works during maintenance', al.ok, al)
      const aliceC = new L.Client('alice-m2'); await aliceC.login(...L.ACCOUNTS.alice)
      t.ok('a signed-in org admin gets 503 on /admin/org', (await aliceC.get('/admin/org')).status === 503)
      const saEnt = await admin.get('/admin/enterprise')
      if (saEnt.status === 503) t.note('During maintenance the super admin is also locked out of /admin/* (enterprise/org admin areas), only /super-admin works.')
    }
  } finally {
    t.section('Restore')
    let restored = false
    for (let i = 0; i < 3 && !restored; i++) restored = await restore().catch(() => false)
    t.ok('original settings restored (GET equals the original)', restored)
    const up = await poll(() => anon.get('/'), (r) => r.status !== 503)
    t.ok('site is back up (home not 503)', up.hit, up.value && up.value.status)
    console.log(`   site back after ${up.ms} ms`)
    const sOn = await poll(() => anon.post('/api/auth/signup', {}), (r) => r.status === 400, { timeout: 10000 })
    t.ok('sign-ups are back on', sOn.hit)
    if (restored) { try { fs.unlinkSync(BACKUP) } catch { /* */ } }
    // Audit entries of these toggles are test noise: remember them for cleanup
    const logs = await p.auditLog.findMany({ where: { entityType: 'PLATFORM', userId: admin.user.id, createdAt: { gte: startedAt } }, select: { id: true } })
    for (const l of logs) L.registry.add('auditLogIds', l.id)
  }
}

main()
  .catch((e) => t.ok('script aborted', false, e && (e.stack || e.message)))
  .finally(async () => {
    if (process.env.E2E_KEEP !== '1') await L.cleanupAll().catch((e) => console.error('cleanup failed', e))
    const fails = t.save()
    await db().$disconnect()
    process.exit(fails ? 1 : 0)
  })
