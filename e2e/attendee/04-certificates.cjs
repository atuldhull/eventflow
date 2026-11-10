// Certificates as a student sees them: alice issues one for the student's registration on a
// completed event -> it shows in /dashboard/certificates, the PDF downloads, the public
// verify page says valid; alice revokes it -> verify says revoked, download refused.
// The completed event no longer takes registrations, so the student's (attended)
// registration is inserted directly (no counters touched). A temporary E2E-ATT template is
// created through alice's API only if Tech Club has none, and deleted afterwards.
// Run: node e2e/attendee/04-certificates.cjs
const L = require('./lib.cjs');
const { db, BASE } = L;
const S = L.suite('04-certificates');
const U = 'e2e-att-cert@test.local';

(async () => {
  if (!(await L.serverUp())) { console.error('Server not responding at ' + BASE); process.exit(2); }
  const started = new Date();
  await L.purgeUsers([U]);
  const user = await L.ensureUser(U, 'E2E-ATT Certificate Student');
  const tech = await db.organization.findUnique({ where: { slug: 'tech-club' } });
  const hack = await db.event.findUnique({ where: { slug: 'hack-the-monsoon-2026' }, include: { ticketTypes: true } });
  const aliceU = await db.user.findUnique({ where: { email: 'alice@test.local' } });
  const reg = await db.registration.create({ data: { registrationNumber: 'E2E-ATT-CERT-1', eventId: hack.id, userId: user.id, ticketTypeId: hack.ticketTypes[0].id, status: 'CHECKED_IN', source: 'E2E', metadata: { e2eNoClaims: true } } });
  let templateId = null, certId = null;
  const browser = await L.launch();
  try {
    const alice = await L.person(browser);
    const st = await L.person(browser, { viewport: L.PHONE });
    const guest = await L.person(browser);
    S.area('Certificates: issue');
    S.check('alice signs in', (await L.loginApi(alice, 'alice@test.local', L.DEMO_PASS)) === 'alice@test.local', '');
    S.check('student signs in', (await L.loginApi(st, U)) === U, '');
    const certs0 = (await L.api(st, 'GET', '/api/users/me/dashboard')).json?.data?.stats?.certificates ?? 0;
    const tpls = (await L.api(alice, 'GET', `/api/admin/org/${tech.id}/certificates/templates`)).json?.data || [];
    if (!tpls.length) {
      const g0 = await L.api(alice, 'POST', `/api/admin/org/${tech.id}/certificates/generate`, { eventId: hack.id, recipientFilter: 'custom', customRecipientIds: [user.id] });
      S.note('Generate with no template in the org', `${g0.status} ${g0.json?.message}`);
      const t = await L.api(alice, 'POST', `/api/admin/org/${tech.id}/certificates/templates`, { name: 'E2E-ATT template', templateHtml: '<div>{{recipientName}} - {{eventTitle}}</div>', isDefault: false });
      templateId = t.json?.data?.id || null;
      if (templateId) L.track('certificateTemplates', templateId);
      S.check('Temporary template created', !!templateId, `${t.status} ${t.json?.message || ''}`);
    }
    const gen = await L.api(alice, 'POST', `/api/admin/org/${tech.id}/certificates/generate`, { eventId: hack.id, recipientFilter: 'custom', customRecipientIds: [user.id], ...(templateId ? { templateId } : {}) });
    S.check('alice generates a certificate for the student only', gen.status === 200 && gen.json?.data?.generated === 1, `${gen.status} ${JSON.stringify(gen.json?.data || gen.json?.message)}`);
    const cert = await db.certificate.findFirst({ where: { userId: user.id, eventId: hack.id } });
    certId = cert?.id;
    if (!cert) throw new Error('no certificate generated');
    L.track('certificates', cert.id);

    S.area('Certificates: student view');
    await L.go(st, '/dashboard/certificates', { settle: 2500 });
    let t = await L.bodyText(st);
    S.check('/dashboard/certificates lists it with event and certificate number', /Hack the Monsoon/.test(t) && t.includes(cert.certificateNumber), t.slice(0, 200).replace(/\n/g, ' '));
    S.check('No horizontal overflow at 390', (await L.overflowX(st)) <= 0, '');
    await L.shot(st, 'cert-dashboard-390');
    const certs1 = (await L.api(st, 'GET', '/api/users/me/dashboard')).json?.data?.stats?.certificates ?? 0;
    S.check('Dashboard certificate count +1', certs1 === certs0 + 1, `${certs0} -> ${certs1}`);
    const n = await db.notification.findMany({ where: { userId: user.id } });
    S.check('Student is notified that the certificate is ready', n.some(x => x.category === 'CERTIFICATE'), `notifications=${n.map(x => x.title).join(',') || 'none'}`);
    const pdf = await L.api(st, 'GET', `/api/certificates/${cert.id}/download`);
    S.check('Certificate PDF downloads', pdf.status === 200 && /pdf/.test(pdf.ct) && pdf.head.startsWith('%PDF') && pdf.size > 1000, `${pdf.status} ${pdf.ct} ${pdf.size}B`);
    const other = await L.person(browser);
    await L.loginApi(other, 'carol@test.local', L.DEMO_PASS);
    const steal = await L.api(other, 'GET', `/api/certificates/${cert.id}/download`);
    S.check('Another student cannot download it', steal.status === 403 || steal.status === 404, `status=${steal.status}`);
    await other.ctx.close();
    await L.go(guest, `/verify/${cert.verificationCode}`, { settle: 1000 });
    t = await L.bodyText(guest);
    S.check('Public verify page: valid, with the student\'s name and event', /Valid/.test(t) && /E2E-ATT Certificate Student/.test(t) && /Hack the Monsoon/.test(t), '');
    await L.shot(guest, 'cert-verify-valid');

    S.area('Certificates: revoke');
    const rv = await L.api(alice, 'PATCH', `/api/admin/org/${tech.id}/certificates/${cert.id}`, { action: 'revoke', reason: 'E2E-ATT test revoke' });
    S.check('alice revokes it', rv.status === 200 && rv.json?.data?.status === 'REVOKED', `${rv.status} ${rv.json?.message}`);
    await L.go(guest, `/verify/${cert.verificationCode}`, { settle: 1000 });
    t = await L.bodyText(guest);
    S.check('Public verify page now says revoked', /Certificate revoked/i.test(t) && !/Certificate verified/i.test(t), '');
    await L.shot(guest, 'cert-verify-revoked');
    await L.go(st, '/dashboard/certificates', { settle: 2500 });
    t = await L.bodyText(st);
    S.check('Student\'s list marks it Revoked', /Revoked/.test(t), '');
    const pdf2 = await L.api(st, 'GET', `/api/certificates/${cert.id}/download`);
    S.check('Revoked certificate cannot be downloaded by the student (410)', pdf2.status === 410, `status=${pdf2.status}`);
    const hasDl = await st.evaluate(() => [...document.querySelectorAll('button')].some(b => /Download/.test(b.innerText) && !b.disabled));
    S.check('Revoked row does not offer an active Download button', !hasDl, '');
    await L.shot(st, 'cert-dashboard-revoked-390');
    const certs2 = (await L.api(st, 'GET', '/api/users/me/dashboard')).json?.data?.stats?.certificates ?? 0;
    S.note('Dashboard certificate count after revoke', `${certs1} -> ${certs2}`);
    const rs = await L.api(alice, 'PATCH', `/api/admin/org/${tech.id}/certificates/${cert.id}`, { action: 'restore' });
    await L.go(guest, `/verify/${cert.verificationCode}`, { settle: 1000 });
    S.check('Restore makes it valid again', rs.status === 200 && /Valid/.test(await L.bodyText(guest)), `${rs.status}`);
    await alice.ctx.close(); await st.ctx.close(); await guest.ctx.close();
  } catch (e) {
    S.check('script crashed', false, e.stack);
  } finally {
    await browser.close();
    try {
      await L.purgeUsers([U]); // cascades the registration and certificate
      if (templateId) await db.certificateTemplate.deleteMany({ where: { id: templateId } });
      await db.auditLog.deleteMany({ where: { userId: aliceU.id, createdAt: { gte: started }, OR: [...(certId ? [{ entityId: certId }] : []), ...(templateId ? [{ entityId: templateId }] : []), { entityId: hack.id, description: { startsWith: 'Generated' } }, { description: { contains: 'E2E-ATT' } }] } });
      S.note('Cleanup', `student, registration, certificate${templateId ? ', temporary template' : ''} and alice's audit rows for them removed`);
    } catch (e) { console.error('cleanup failed', e.message); }
    await db.$disconnect();
  }
  process.exitCode = S.finish() ? 1 : 0;
})();
