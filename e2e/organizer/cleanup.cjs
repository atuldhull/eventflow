// Deletes everything the organizer e2e scripts created (safe to run any time, idempotent):
// events titled "E2E-ORG..." in Tech Club and all their rows, e2e-org-* users and their rows,
// audit rows written during the run by alice or the e2e users, communication drafts and
// pending invites they left in Tech Club's settings, certificate templates / site config /
// media they created, uploaded files, and the org fields the settings test changed.
// Usage: node e2e/organizer/cleanup.cjs [--keep-state]
const fs = require('fs')
const path = require('path')
const L = require('./lib.cjs')

;(async () => {
  const db = L.db()
  const S = L.loadState() || { created: {}, snapshot: {} }
  const created = S.created || {}
  const out = {}
  const { orgId, aliceId } = await L.orgIds()

  // ---- events ----
  const events = await db.event.findMany({
    where: { OR: [{ id: { in: created.events || [] } }, { title: { startsWith: L.TITLE_PREFIX } }] },
    select: { id: true, title: true, organizationId: true },
  })
  const foreign = events.filter((e) => e.organizationId && e.organizationId !== orgId && !(created.events || []).includes(e.id))
  if (foreign.length) console.log('Skipping E2E-ORG titled events outside Tech Club (not ours):', foreign.map((e) => e.id))
  const eventIds = events.filter((e) => !foreign.includes(e)).map((e) => e.id)

  // ---- users ----
  const users = await db.user.findMany({
    where: { OR: [{ email: { startsWith: L.EMAIL_PREFIX } }, { email: { in: created.users || [] } }] },
    select: { id: true, email: true },
  })
  const userIds = users.map((u) => u.id)
  const emails = users.map((u) => u.email)

  const regIds = (await db.registration.findMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] }, select: { id: true } })).map((r) => r.id)
  const certIds = (await db.certificate.findMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] }, select: { id: true } })).map((c) => c.id)
  const memberIds = (await db.organizationMember.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((m) => m.id)
  const entityIds = [...eventIds, ...regIds, ...certIds, ...memberIds, ...userIds, ...(created.misc || [])]

  // ---- audit rows ----
  const since = S.startedAt ? new Date(S.startedAt) : null
  out.audit = (await db.auditLog.deleteMany({
    where: {
      OR: [
        { eventId: { in: eventIds } },
        { entityId: { in: entityIds } },
        { userId: { in: userIds } },
        ...(since ? [{ userId: aliceId, createdAt: { gte: since } }] : []),
      ],
    },
  })).count

  // ---- rows of the events and users ----
  const evOrUser = { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] }
  out.checkIns = (await db.checkIn.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }, { checkedInBy: { in: userIds } }] } })).count
  out.certificates = (await db.certificate.deleteMany({ where: evOrUser })).count
  out.tickets = (await db.ticket.deleteMany({ where: evOrUser })).count
  out.payments = (await db.payment.deleteMany({ where: evOrUser })).count
  out.waitlist = (await db.waitlistEntry.deleteMany({ where: evOrUser })).count
  out.teamMembers = (await db.teamMember.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { team: { eventId: { in: eventIds } } }] } })).count
  out.registrations = (await db.registration.deleteMany({ where: evOrUser })).count
  out.teams = (await db.team.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { leaderId: { in: userIds } }] } })).count
  out.notifications = (await db.notification.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }, { senderId: { in: userIds } }] } })).count
  out.announcements = (await db.announcement.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { createdById: { in: userIds } }] } })).count
  out.feedback = (await db.feedback.deleteMany({ where: evOrUser })).count
  out.savedEvents = (await db.savedEvent.deleteMany({ where: evOrUser })).count
  out.eventMedia = (await db.eventMedia.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { uploadedById: { in: userIds } }] } })).count
  out.events = (await db.event.deleteMany({ where: { id: { in: eventIds } } })).count

  // ---- certificate templates, site config, media created by the scripts ----
  const tplWhere = { OR: [{ id: { in: created.certTemplates || [] } }, { name: { startsWith: L.TITLE_PREFIX } }] }
  await db.certificate.updateMany({ where: { template: tplWhere }, data: { templateId: null } })
  out.certTemplates = (await db.certificateTemplate.deleteMany({ where: tplWhere })).count
  out.siteMedia = (await db.siteMedia.deleteMany({ where: { OR: [{ id: { in: created.siteMedia || [] } }, { fileName: { startsWith: 'e2e-org' } }] } })).count
  if ((created.siteConfigs || []).length) {
    out.sitePages = (await db.sitePage.deleteMany({ where: { siteConfigId: { in: created.siteConfigs } } })).count
    out.siteConfigs = (await db.siteConfig.deleteMany({ where: { id: { in: created.siteConfigs } } })).count
  }
  if (S.snapshot?.siteConfig) {
    // a site config that existed before: put its editable fields back
    const sc = S.snapshot.siteConfig
    await db.siteConfig.update({ where: { id: sc.id }, data: { sections: sc.sections, styles: sc.styles, isPublished: sc.isPublished, publishedAt: sc.publishedAt ? new Date(sc.publishedAt) : null, content: sc.content ?? undefined } }).catch(() => {})
    out.siteConfigRestored = sc.id
  }
  out.featureModuleData = (await db.featureModuleData.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { createdById: { in: userIds } }, { title: { startsWith: L.TITLE_PREFIX } }] } })).count

  // ---- users ----
  out.otps = (await db.oTP.deleteMany({ where: { OR: [{ email: { in: emails } }, { email: { startsWith: L.EMAIL_PREFIX } }, { userId: { in: userIds } }] } })).count
  out.memberships = (await db.organizationMember.deleteMany({ where: { userId: { in: userIds } } })).count
  out.enterpriseMemberships = (await db.enterpriseMember.deleteMany({ where: { userId: { in: userIds } } })).count
  out.users = (await db.user.deleteMany({ where: { id: { in: userIds } } })).count

  // ---- Tech Club settings: drafts, pending invites, fields the settings test changed ----
  const org = await db.organization.findUnique({ where: { id: orgId } })
  const settings = org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings) ? { ...org.settings } : null
  const orgPatch = {}
  if (settings) {
    let changed = false
    for (const [key, test] of [['communicationDrafts', (d) => String(d?.subject || '').startsWith(L.TITLE_PREFIX) || String(d?.body || '').includes(L.TITLE_PREFIX)], ['pendingInvites', (i) => String(i?.email || '').startsWith(L.EMAIL_PREFIX)], ['acceptedInvites', (i) => String(i?.email || i || '').startsWith(L.EMAIL_PREFIX)]]) {
      if (Array.isArray(settings[key])) {
        const kept = settings[key].filter((x) => !test(x))
        if (kept.length !== settings[key].length) { out[key] = settings[key].length - kept.length; settings[key] = kept; changed = true }
        if (kept.length === 0 && S.snapshot?.orgSettings !== undefined && !(S.snapshot.orgSettings && key in S.snapshot.orgSettings)) { delete settings[key]; changed = true }
      }
    }
    if (S.snapshot && 'orgSettings' in S.snapshot) {
      const before = S.snapshot.orgSettings || {}
      for (const key of ['billing', 'eventDefaults']) {
        if (key in before) settings[key] = before[key]; else delete settings[key]
        changed = true
      }
    }
    if (changed) orgPatch.settings = Object.keys(settings).length ? settings : (S.snapshot?.orgSettings === null ? null : {})
  }
  if (S.snapshot?.orgFields) Object.assign(orgPatch, S.snapshot.orgFields)
  if (Object.keys(orgPatch).length) {
    if (orgPatch.settings === null) orgPatch.settings = require(L.ROOT + '/node_modules/@prisma/client').Prisma.DbNull
    await db.organization.update({ where: { id: orgId }, data: orgPatch })
    out.orgRestored = Object.keys(orgPatch)
  }

  // ---- uploaded files ----
  let files = 0
  for (const url of created.uploads || []) {
    const name = path.basename(String(url).split('?')[0])
    for (const dir of [path.join(L.ROOT, 'uploads'), path.join(L.ROOT, 'public', 'uploads')]) {
      const f = path.join(dir, name)
      if (name && fs.existsSync(f)) { fs.unlinkSync(f); files++ }
    }
  }
  out.uploadedFiles = files

  // ---- leftovers check ----
  const left = {
    events: await db.event.count({ where: { title: { startsWith: L.TITLE_PREFIX }, organizationId: orgId } }),
    users: await db.user.count({ where: { email: { startsWith: L.EMAIL_PREFIX } } }),
    registrations: await db.registration.count({ where: { user: { email: { startsWith: L.EMAIL_PREFIX } } } }),
    templates: await db.certificateTemplate.count({ where: { name: { startsWith: L.TITLE_PREFIX } } }),
  }
  console.log('Deleted:', JSON.stringify(out))
  console.log('Left over (should all be 0):', JSON.stringify(left))
  await db.$disconnect()
  if (!process.argv.includes('--keep-state')) {
    try { fs.unlinkSync(path.join(L.OUT, 'state.json')) } catch {}
  }
})().catch(async (e) => { console.error(e); process.exitCode = 1; try { await L.db().$disconnect() } catch {} })
