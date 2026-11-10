// Removes everything the platform e2e scripts create (e2e-ent- users/slugs, "E2E-ENT …" names,
// their events, payments, notifications, audit entries, uploaded files) and, if
// 03-platform-settings.cjs was interrupted, puts the platform settings back from its backup.
// Usage: node e2e/platform/cleanup.cjs
'use strict'
const fs = require('fs')
const path = require('path')
const L = require('./lib.cjs')

;(async () => {
  const backup = path.join(L.OUT, 'settings-backup.json')
  if (fs.existsSync(backup)) {
    const { settings, rowExisted } = JSON.parse(fs.readFileSync(backup, 'utf8'))
    const admin = await L.loginAs('admin')
    const r = await admin.post('/api/super-admin/settings', settings)
    const back = await admin.get('/api/super-admin/settings')
    const same = JSON.stringify(back.body.data.settings) === JSON.stringify(settings)
    if (same && !rowExisted) await L.db().featureModuleData.deleteMany({ where: { uniqueKey: 'platform:settings' } })
    console.log(`platform settings restored from backup: ${r.status} (identical: ${same})`)
    if (same) fs.unlinkSync(backup)
  }
  await L.cleanupAll()
  const p = L.db()
  const left = {
    users: await p.user.count({ where: { email: { startsWith: L.PREFIX } } }),
    enterprises: await p.enterprise.count({ where: { OR: [{ slug: { startsWith: L.PREFIX } }, { name: { startsWith: L.NAME_PREFIX } }] } }),
    orgs: await p.organization.count({ where: { OR: [{ slug: { startsWith: L.PREFIX } }, { name: { startsWith: L.NAME_PREFIX } }] } }),
    events: await p.event.count({ where: { OR: [{ slug: { startsWith: L.PREFIX } }, { title: { startsWith: L.NAME_PREFIX } }] } }),
  }
  console.log(`left over: ${JSON.stringify(left)}`)
  await p.$disconnect()
  process.exit(Object.values(left).some(Boolean) ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
