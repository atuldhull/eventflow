// Removes everything the attendee e2e scripts create and checks the event counters are
// back to their starting values.
//   node e2e/attendee/cleanup.cjs          remove test data, compare counters
//   node e2e/attendee/cleanup.cjs --dry    only list what would be removed
// Test data = users whose email starts with e2e-att- (cascade: registrations, tickets,
// payments, notifications, OTPs, certificates, saved events, memberships, audit rows),
// events with slug e2e-att-*, certificate templates named "E2E-ATT template",
// notifications / audit rows mentioning E2E-ATT, and e2e-att- entries in organizations'
// pendingInvites / acceptedInvites. Seats, ticket stock and coupon uses still held by
// test registrations are given back before deletion (see purgeUsers in lib.cjs).
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const { db } = L;
const dry = process.argv.includes('--dry');

(async () => {
  const users = await db.user.findMany({ where: { email: { startsWith: L.PREFIX } }, select: { email: true, _count: { select: { registrations: true, notifications: true, certificates: true } } } });
  const events = await db.event.findMany({ where: { slug: { startsWith: L.PREFIX } }, select: { id: true, slug: true } });
  const templates = await db.certificateTemplate.findMany({ where: { name: 'E2E-ATT template' }, select: { id: true } });
  const notes = await db.notification.count({ where: { OR: [{ title: { contains: 'E2E-ATT' } }, { message: { contains: 'E2E-ATT' } }, { message: { contains: L.PREFIX } }] } });
  const audits = await db.auditLog.count({ where: { OR: [{ description: { contains: L.PREFIX } }, { description: { contains: 'E2E-ATT' } }] } });
  const orgs = await db.organization.findMany({ select: { id: true, slug: true, settings: true } });
  const orgHits = orgs.filter(o => ['pendingInvites', 'acceptedInvites'].some(k => Array.isArray(o.settings?.[k]) && o.settings[k].some(i => String(i?.email || '').startsWith(L.PREFIX))));
  console.log(`users: ${users.length}`); users.forEach(u => console.log(`  ${u.email}  regs=${u._count.registrations} notes=${u._count.notifications} certs=${u._count.certificates}`));
  console.log(`events: ${events.map(e => e.slug).join(', ') || 0}`);
  console.log(`certificate templates: ${templates.length}, extra notifications: ${notes}, audit rows: ${audits}, orgs with test invites: ${orgHits.map(o => o.slug).join(', ') || 0}`);
  if (dry) { await db.$disconnect(); return; }

  const log = await L.purgeUsers(users.map(u => u.email));
  log.forEach(l => console.log('  gave back: ' + l));
  for (const e of events) {
    const regs = await db.registration.count({ where: { eventId: e.id, user: { email: { not: { startsWith: L.PREFIX } } } } });
    if (regs) { console.log(`  kept event ${e.slug}: it has ${regs} non-test registrations`); continue; }
    await db.event.delete({ where: { id: e.id } });
  }
  if (templates.length) await db.certificateTemplate.deleteMany({ where: { id: { in: templates.map(t => t.id) } } });
  await db.notification.deleteMany({ where: { OR: [{ title: { contains: 'E2E-ATT' } }, { message: { contains: 'E2E-ATT' } }, { message: { contains: L.PREFIX } }] } });
  await db.auditLog.deleteMany({ where: { OR: [{ description: { contains: L.PREFIX } }, { description: { contains: 'E2E-ATT' } }] } });
  for (const o of orgHits) {
    await db.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', o.id);
      const cur = (await tx.organization.findUnique({ where: { id: o.id }, select: { settings: true } })).settings || {};
      const next = { ...cur };
      for (const k of ['pendingInvites', 'acceptedInvites']) if (Array.isArray(next[k])) next[k] = next[k].filter(i => !String(i?.email || '').startsWith(L.PREFIX));
      await tx.organization.update({ where: { id: o.id }, data: { settings: next } });
    });
  }

  // Counters vs the snapshot taken before the first script ran
  const snapFile = path.join(L.OUT, 'counters.json');
  if (fs.existsSync(snapFile)) {
    const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
    const now = await L.readCounters();
    let diffs = 0;
    for (const [slug, s] of Object.entries(snap)) {
      const n = now[slug]; if (!n) continue;
      const out = [];
      if (n.currentRegistrations !== s.currentRegistrations) out.push(`seats ${s.currentRegistrations} -> ${n.currentRegistrations}`);
      for (const [id, t] of Object.entries(s.ticketTypes)) if (n.ticketTypes[id] && n.ticketTypes[id].sold !== t.sold) out.push(`${t.name} sold ${t.sold} -> ${n.ticketTypes[id].sold}`);
      for (const [id, c] of Object.entries(s.coupons)) if (n.coupons[id] && n.coupons[id].currentUses !== c.currentUses) out.push(`coupon ${c.code} uses ${c.currentUses} -> ${n.coupons[id].currentUses}`);
      if (out.length) {
        diffs++;
        const since = fs.statSync(snapFile).mtime;
        const others = await db.registration.count({ where: { event: { slug }, updatedAt: { gte: since }, user: { email: { not: { startsWith: L.PREFIX } } } } });
        console.log(`  COUNTER DIFF ${slug}: ${out.join('; ')}  (registrations by other people changed since the snapshot: ${others})`);
      }
    }
    if (!diffs) {
      console.log('counters: all back to their starting values');
      fs.unlinkSync(snapFile);
      const reg = path.join(L.OUT, 'created.json'); if (fs.existsSync(reg)) fs.unlinkSync(reg);
    } else console.log('counters: differences above (snapshot kept at ' + snapFile + ')');
  } else console.log('counters: no snapshot found (nothing to compare)');
  const left = await db.user.count({ where: { email: { startsWith: L.PREFIX } } });
  console.log(`remaining e2e-att- users: ${left}`);
  await db.$disconnect();
})();
