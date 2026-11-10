// Accounts: signup (validation, steps 1-2-3, OTP from the DB), first login, a guest taking
// over their guest registration by signing up, a pending org invite accepted at signup,
// unverified login -> verify page, forgot/reset password, login lockout, callbackUrl round
// trip (and open-redirect guard), keyboard-only login and form labels.
// Run: node e2e/attendee/02-auth.cjs
const L = require('./lib.cjs');
const { db, BASE, PASS } = L;
const S = L.suite('02-auth');
// SKIP=signup,guest,invite,unverified,reset,lock,callback,a11y skips those sections
const SKIP = (process.env.SKIP || '').split(',').filter(Boolean);
let t;

const U1 = 'e2e-att-1@test.local';
const GUEST = 'e2e-att-guest@test.local';
const INVITEE = 'e2e-att-invite@test.local';
const UNVERIFIED = 'e2e-att-unverified@test.local';
const RESET = 'e2e-att-reset@test.local';
const LOCK = `e2e-att-lock-${Date.now().toString(36)}@test.local`; // new address each run: the lock is in memory for 15 min

async function typeOtp(page, code) {
  await page.waitForSelector('input[aria-label="Digit 1"]', { visible: true });
  await page.focus('input[aria-label="Digit 1"]');
  await page.keyboard.type(code, { delay: 40 });
}

async function uiSignup(page, { name, email, password = PASS, phone = '' }) {
  await L.go(page, '/signup', { settle: 1000 });
  await L.typeInto(page, '#name', name);
  await L.typeInto(page, '#signup-email', email);
  await L.typeInto(page, '#signup-password', password);
  await L.typeInto(page, '#confirm-password', password);
  await page.click('[role=checkbox]');
  await L.clickText(page, /^Next/, 'button');
  await L.waitText(page, /Step 2 of 3/);
  if (phone) await L.typeInto(page, '#phone', phone);
  await L.clickText(page, /^Next$/, 'button');
  return L.waitText(page, /Step 3 of 3/, 30000);
}

async function cleanOrgInvites(orgId) {
  await db.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', orgId);
    const org = await tx.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const s = org.settings && typeof org.settings === 'object' ? { ...org.settings } : {};
    let changed = false;
    for (const k of ['pendingInvites', 'acceptedInvites']) {
      if (Array.isArray(s[k])) { const kept = s[k].filter(i => !String(i?.email || '').startsWith(L.PREFIX)); if (kept.length !== s[k].length) { s[k] = kept; changed = true; } }
    }
    if (changed) await tx.organization.update({ where: { id: orgId }, data: { settings: s } });
  });
}

async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement; if (!el || el === document.body) return { tag: 'BODY' };
    const cs = getComputedStyle(el);
    const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
    return { tag: el.tagName, id: el.id, type: el.getAttribute('type'), text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), focusVisible: el.matches(':focus-visible'), ring: visible };
  });
}
async function unlabeled(page) {
  return page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]), select, textarea, button[role=checkbox], [role=checkbox]')]
    .filter(e => e.getBoundingClientRect().width > 0)
    .filter(e => !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) || e.closest('label')))
    .map(e => e.outerHTML.slice(0, 90)));
}

(async () => {
  if (!(await L.serverUp())) { console.error('Server not responding at ' + BASE); process.exit(2); }
  await L.snapshotCounters();
  const techClub = await db.organization.findUnique({ where: { slug: 'tech-club' } });
  await L.purgeUsers([...(SKIP.includes('signup') ? [] : [U1]), INVITEE, UNVERIFIED, RESET, LOCK]);
  if (SKIP.includes('signup')) await L.ensureUser(U1, 'E2E-ATT One');
  await cleanOrgInvites(techClub.id);
  const browser = await L.launch();
  try {
    // ------------------------------------------------------------------ signup validation + steps
    if (!SKIP.includes('signup')) {
    S.area('Signup: validation and steps');
    const p = await L.person(browser, { viewport: L.PHONE });
    await L.go(p, '/signup', { settle: 1000 });
    S.check('/signup shows "Step 1 of 3"', /Step 1 of 3/.test(await L.bodyText(p)), '');
    await L.clickText(p, /^Next/, 'button');
    await L.sleep(600);
    t = await L.bodyText(p);
    S.check('Empty step 1: name, email, password and terms errors shown', /at least 2 characters/i.test(t) && /Invalid email/i.test(t) && /Minimum 8|required/i.test(t) && /agree to the terms/i.test(t), t.match(/(Name must[^\n]*|Invalid email[^\n]*|Minimum[^\n]*|You must[^\n]*)/g)?.join(' | '));
    S.check('Empty step 1: stays on step 1', /Step 1 of 3/.test(t), '');
    await L.shot(p, 'signup-step1-errors-390');
    await L.typeInto(p, '#name', 'E2E-ATT One');
    await L.typeInto(p, '#signup-email', U1);
    await L.typeInto(p, '#signup-password', 'weakpass');
    await L.typeInto(p, '#confirm-password', 'weakpass2');
    await L.clickText(p, /^Next/, 'button');
    await L.sleep(600);
    t = await L.bodyText(p);
    S.check('Weak password: says what is missing (uppercase/number/special)', /uppercase|number|special/i.test(t), t.match(/Must contain[^\n]*/g)?.join(' | '));
    S.note('Weak password + mismatched confirmation', /Passwords don.t match/i.test(t) ? 'both errors shown together' : 'only the password rule is shown; "Passwords don\'t match" appears only after the password is fixed (second round of errors)');
    const a11ySignup = await p.evaluate(() => [...document.querySelectorAll('input[aria-invalid=true]')].map(i => ({ id: i.id, describedby: i.getAttribute('aria-describedby') })));
    S.check('Signup errors are linked to their fields (aria-describedby)', a11ySignup.length > 0 && a11ySignup.every(x => x.describedby), JSON.stringify(a11ySignup));
    await p.click('[role=checkbox]');
    await L.typeInto(p, '#signup-password', PASS);
    await L.typeInto(p, '#confirm-password', PASS + 'x');
    await L.clickText(p, /^Next/, 'button');
    await L.sleep(600);
    S.check('Mismatched confirmation: "Passwords don\'t match"', /Passwords don.t match/i.test(await L.bodyText(p)), '');
    await L.typeInto(p, '#signup-password', PASS);
    await L.typeInto(p, '#confirm-password', PASS);
    await L.clickText(p, /^Next/, 'button');
    S.check('Valid step 1 -> "Step 2 of 3"', await L.waitText(p, /Step 2 of 3/), '');
    await L.shot(p, 'signup-step2-390');
    await L.typeInto(p, '#phone', '12345');
    await L.clickText(p, /^Next$/, 'button');
    await L.sleep(2500);
    t = await L.bodyText(p);
    const tst = await L.toasts(p);
    S.check('Invalid phone on step 2: a clear message (not a generic "Validation failed")', /Invalid Indian phone|phone/i.test(t + tst.join(' ')) && !/^Validation failed$/.test(tst[0] || ''), `toasts=${tst.join(' | ')} step3=${/Step 3/.test(t)}`);
    await L.shot(p, 'signup-step2-badphone-390');
    if (/Step 3 of 3/.test(t)) { S.note('Bad phone accepted', 'went on to step 3'); }
    else {
      await L.typeInto(p, '#phone', '');
      await L.typeInto(p, '#college', 'E2E Test College');
      await L.clickText(p, /^Next$/, 'button');
    }
    S.check('Step 2 -> account created -> "Step 3 of 3" (verify email)', await L.waitText(p, /Step 3 of 3/, 30000), (await L.toasts(p)).join(' | '));
    const u1 = await db.user.findUnique({ where: { email: U1 } });
    if (u1) L.track('users', U1);
    S.check('DB: user created, not yet verified, password hashed', u1 && !u1.emailVerified && u1.passwordHash && u1.passwordHash !== PASS, '');
    const otp1 = await L.latestOtp(U1, 'VERIFY_EMAIL');
    S.check('DB: a VERIFY_EMAIL code was stored (email path did not error)', !!otp1, '');
    S.check('Resend is on a visible countdown', /Resend in \d+s/.test(await L.bodyText(p)), '');
    await L.shot(p, 'signup-step3-390');
    await typeOtp(p, otp1 === '000000' ? '111111' : '000000');
    await L.sleep(2500);
    const bad = await L.toasts(p);
    S.check('Wrong code: error shown, still on step 3', bad.some(x => /invalid|incorrect|expired|wrong/i.test(x)) && /Step 3 of 3/.test(await L.bodyText(p)), bad.join(' | '));
    // clear the digits and enter the right code
    await p.evaluate(() => document.querySelectorAll('input[aria-label^="Digit"]').forEach(i => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); }));
    await typeOtp(p, otp1);
    await L.sleep(6000);
    const landed = p.url().replace(BASE, '');
    const sess = await L.api(p, 'GET', '/api/auth/session');
    S.check('Correct code: verified and signed straight in (first login)', sess.json?.user?.email === U1, `landed=${landed}`);
    S.check('First login lands on the attendee dashboard', /^\/dashboard/.test(landed), landed);
    const u1v = await db.user.findUnique({ where: { email: U1 } });
    S.check('DB: emailVerified set, code marked used', !!u1v?.emailVerified && !(await L.latestOtp(U1, 'VERIFY_EMAIL')), '');
    await L.go(p, '/dashboard', { settle: 1500 });
    t = await L.bodyText(p);
    S.check('New user dashboard: zero counts and a friendly empty state', /Nothing coming up yet/i.test(t), t.slice(0, 200).replace(/\n/g, ' '));
    await L.shot(p, 'first-login-dashboard-390');
    await p.ctx.close();

    }
    // ------------------------------------------------------------------ duplicate signup
    if (!SKIP.includes('signup')) {
    const dup = await L.person(browser);
    const d = await L.api(dup, 'POST', '/api/auth/signup', { name: 'Dup', email: U1, password: PASS, confirmPassword: PASS, agreeToTerms: true });
    S.check('Signing up again with a verified email is refused (409)', d.status === 409, `${d.status} ${d.json?.message}`);
    await dup.ctx.close();

    }
    // ------------------------------------------------------------------ guest takes over their registration
    if (!SKIP.includes('guest')) {
    S.area('Signup: guest account taken over');
    const guest = await db.user.findUnique({ where: { email: GUEST }, include: { registrations: { include: { event: true } } } });
    if (!guest || guest.passwordHash || !guest.registrations.length) {
      S.note('Guest takeover skipped', 'run 01-guest.cjs first (it leaves a passwordless guest with a Carnatic Evening registration)');
    } else {
      const gp = await L.person(browser, { viewport: L.PHONE });
      const ok = await uiSignup(gp, { name: 'E2E-ATT Guest', email: GUEST });
      S.check('Guest email can sign up (reaches step 3)', ok, (await L.toasts(gp)).join(' | '));
      await typeOtp(gp, await L.latestOtp(GUEST, 'VERIFY_EMAIL'));
      await L.sleep(6000);
      await L.go(gp, '/dashboard/tickets', { settle: 2500 });
      t = await L.bodyText(gp);
      S.check('After signup the guest registration\'s ticket is in /dashboard/tickets', /Carnatic Evening/i.test(t), t.slice(0, 200).replace(/\n/g, ' '));
      await L.shot(gp, 'guest-takeover-tickets-390');
      await gp.ctx.close();
    }

    }
    // ------------------------------------------------------------------ pending invite accepted at signup
    if (!SKIP.includes('invite')) {
    S.area('Signup: pending org invite accepted');
    const alice = await L.person(browser);
    S.check('alice signs in', (await L.loginApi(alice, 'alice@test.local', L.DEMO_PASS)) === 'alice@test.local', '');
    const inv = await L.api(alice, 'POST', '/api/members/invite', { email: INVITEE, role: 'VIEWER', entityType: 'ORGANIZATION', entityId: techClub.id });
    S.check('alice invites a not-yet-registered email to Tech Club as Viewer', inv.status < 300, `${inv.status} ${inv.json?.message}`);
    const settings = (await db.organization.findUnique({ where: { id: techClub.id } })).settings || {};
    S.check('Invite stored as pending', (settings.pendingInvites || []).some(i => i.email === INVITEE), '');
    const ip = await L.person(browser);
    const su = await L.api(ip, 'POST', '/api/auth/signup', { name: 'E2E-ATT Invitee', email: INVITEE, password: PASS, confirmPassword: PASS, agreeToTerms: true });
    L.track('users', INVITEE);
    S.check('Invitee signs up (201)', su.status === 201, `${su.status} ${su.json?.message}`);
    const ve = await L.api(ip, 'POST', '/api/auth/verify-email', { email: INVITEE, otp: await L.latestOtp(INVITEE, 'VERIFY_EMAIL') });
    S.check('Invitee verifies the email code', ve.status === 200, `${ve.status} ${ve.json?.message}`);
    const invU = await db.user.findUnique({ where: { email: INVITEE } });
    const mem = invU && await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: techClub.id, userId: invU.id } } });
    S.check('Membership created with the invited role (VIEWER)', mem && mem.isActive && mem.role === 'VIEWER', mem ? mem.role : 'none');
    const s2 = (await db.organization.findUnique({ where: { id: techClub.id } })).settings || {};
    S.check('Invite moved from pending to accepted', !(s2.pendingInvites || []).some(i => i.email === INVITEE) && (s2.acceptedInvites || []).some(i => i.email === INVITEE), '');
    const nInv = invU && await db.notification.findMany({ where: { userId: invU.id } });
    const aliceU = await db.user.findUnique({ where: { email: 'alice@test.local' } });
    const nAlice = await db.notification.findMany({ where: { userId: aliceU.id, createdAt: { gte: new Date(Date.now() - 5 * 60e3) }, message: { contains: 'E2E-ATT Invitee' } } });
    S.check('Invitee and inviter are both notified', nInv?.length > 0 && nAlice.length > 0, `invitee=${nInv?.length} alice=${nAlice.length}`);
    for (const n of nAlice) L.track('notifications', n.id);
    const members = await L.api(alice, 'GET', `/api/admin/org/${techClub.id}/members`);
    S.check('alice\'s members list shows the new member', JSON.stringify(members.json || '').includes(INVITEE), `status=${members.status}`);
    S.check('Invitee can sign in and open the organizer workspace (/admin)', (await L.loginApi(ip, INVITEE)) === INVITEE && (await L.go(ip, '/admin', { settle: 800 })) === 200 && /\/admin/.test(ip.url()), ip.url());
    await ip.ctx.close();

    }
    // ------------------------------------------------------------------ unverified login -> verify page
    if (!SKIP.includes('unverified')) {
    S.area('Login: unverified account');
    const uv = await L.person(browser, { viewport: L.PHONE });
    await L.api(uv, 'POST', '/api/auth/signup', { name: 'E2E-ATT Unverified', email: UNVERIFIED, password: PASS, confirmPassword: PASS, agreeToTerms: true });
    L.track('users', UNVERIFIED);
    await db.oTP.updateMany({ where: { email: UNVERIFIED }, data: { createdAt: new Date(Date.now() - 11 * 60e3) } }); // keep the 3-per-10-min OTP limit free for the resend below
    await L.go(uv, '/login', { settle: 1000 });
    await L.typeInto(uv, '#email', UNVERIFIED);
    await L.typeInto(uv, '#password', PASS);
    await uv.keyboard.press('Enter');
    await L.sleep(3000);
    const ut = await L.toasts(uv);
    S.check('Unverified login: "Please verify your email" with a way to get a code', ut.some(x => /verify your email/i.test(x)), ut.join(' | '));
    await L.shot(uv, 'login-unverified-390');
    const clicked = await L.clickText(uv, /(send|verify|code)/i, '[data-sonner-toast] button');
    await L.sleep(3500);
    S.check('Toast action opens /verify-email with the code sent', clicked && /\/verify-email/.test(uv.url()), uv.url());
    if (/\/verify-email/.test(uv.url())) {
      await typeOtp(uv, await L.latestOtp(UNVERIFIED, 'VERIFY_EMAIL'));
      await L.sleep(4000);
      const uvU = await db.user.findUnique({ where: { email: UNVERIFIED } });
      S.check('/verify-email: correct code verifies the account', !!uvU?.emailVerified, uv.url());
      S.check('/verify-email: then asks to log in (keeps the user moving)', /\/login|\/dashboard/.test(uv.url()), uv.url());
    }
    await uv.ctx.close();

    }
    // ------------------------------------------------------------------ forgot / reset password
    if (!SKIP.includes('reset')) {
    S.area('Forgot password -> reset');
    await L.ensureUser(RESET, 'E2E-ATT Reset');
    const fp = await L.person(browser, { viewport: L.PHONE });
    await L.go(fp, '/login', { settle: 800 });
    S.check('Login page links to forgot password', await fp.evaluate(() => !!document.querySelector('a[href="/forgot-password"]')), '');
    await L.go(fp, '/forgot-password', { settle: 1000 });
    await L.typeInto(fp, '#reset-email', RESET);
    await fp.keyboard.press('Enter');
    S.check('Email step -> code + new password step', await L.waitText(fp, /Verification code/, 15000), (await L.toasts(fp)).join(' | '));
    const rcode = await L.latestOtp(RESET, 'RESET_PASSWORD');
    S.check('DB: RESET_PASSWORD code stored', !!rcode, '');
    const NEWPASS = 'E2eAtt@NewPass9';
    await typeOtp(fp, rcode);
    await L.sleep(800);
    if (await fp.$('#new-password')) {
      await L.typeInto(fp, '#new-password', NEWPASS);
      await L.typeInto(fp, '#confirm-new-password', NEWPASS);
      await L.shot(fp, 'reset-password-390');
      await L.clickText(fp, /reset password|reset|save/i, 'button[type=submit]');
    }
    await L.sleep(4000);
    const ft = await L.toasts(fp);
    S.check('Reset succeeds ("Password reset successfully!") and returns to /login', ft.some(x => /reset successfully/i.test(x)) || /\/login/.test(fp.url()), `${ft.join(' | ')} url=${fp.url()}`);
    const fp2 = await L.person(browser);
    S.check('Old password no longer works', (await L.loginApi(fp2, RESET, PASS)) === null, '');
    S.check('New password works', (await L.loginApi(fp2, RESET, NEWPASS)) === RESET, '');
    const reuse = await L.api(fp2, 'POST', '/api/auth/reset-password', { email: RESET, otp: rcode, newPassword: 'E2eAtt@Another1', confirmPassword: 'E2eAtt@Another1' });
    S.check('The reset code cannot be reused', reuse.status === 400 && !/Validation failed/.test(reuse.json?.message || ''), `${reuse.status} ${reuse.json?.message}`);
    const unknown = await L.api(fp2, 'POST', '/api/auth/forgot-password', { email: 'e2e-att-nobody@test.local' });
    S.check('Unknown email: same neutral answer (no account enumeration)', unknown.status === 200 && /If an account exists/i.test(unknown.json?.message || ''), unknown.json?.message);
    await fp.ctx.close(); await fp2.ctx.close();

    }
    // ------------------------------------------------------------------ login lockout
    if (!SKIP.includes('lock')) {
    S.area('Login: rate limiting');
    await L.ensureUser(LOCK, 'E2E-ATT Lock');
    const lp = await L.person(browser, { viewport: L.PHONE });
    await L.go(lp, '/login', { settle: 1000 });
    const msgs = [];
    for (let i = 1; i <= 6; i++) {
      if (!(await lp.$('#email'))) { msgs.push('(page left /login: ' + lp.url().replace(BASE, '') + ')'); await L.shot(lp, 'login-lock-left-' + i); await L.go(lp, '/login', { settle: 1000 }); }
      await L.typeInto(lp, '#email', LOCK);
      await L.typeInto(lp, '#password', i === 6 ? PASS : 'Wrong@pass' + i);
      await lp.keyboard.press('Enter');
      await L.sleep(2500);
      const tt = await L.toasts(lp);
      msgs.push((tt[0] || '(none)') + (lp.url().includes('/login') ? '' : ' [now at ' + lp.url().replace(BASE, '') + ']'));
      await L.sleep(5000); // let this toast expire so the next attempt's message is unambiguous
    }
    S.check('Wrong password: "Invalid email or password" style message', /invalid/i.test(msgs[0]), msgs[0]);
    S.check('After 5 wrong passwords even the right one is refused with a lock message and wait time', /too many attempts/i.test(msgs[5]) && /\d+ minute/.test(msgs[5]), msgs.join(' || '));
    S.check('Locked attempt does not sign in', (await L.api(lp, 'GET', '/api/auth/session')).json?.user == null, '');
    await L.shot(lp, 'login-locked-390');
    await lp.ctx.close();
    S.note('Lockout cleanup', 'the lock is in-memory for that one email (15 min); the account is deleted by cleanup.cjs');

    }
    // ------------------------------------------------------------------ callbackUrl round trip
    if (!SKIP.includes('callback')) {
    S.area('Login: callbackUrl round trip');
    const cp = await L.person(browser);
    await L.go(cp, '/dashboard/tickets', { settle: 1000 });
    const loginUrl = cp.url();
    S.check('Signed-out /dashboard/tickets -> /login?callbackUrl=/dashboard/tickets', /\/login\?callbackUrl=%2Fdashboard%2Ftickets/.test(loginUrl), loginUrl);
    await L.typeInto(cp, '#email', U1);
    await L.typeInto(cp, '#password', PASS);
    await cp.keyboard.press('Enter');
    await cp.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => { });
    await L.sleep(1500);
    S.check('After login: back on /dashboard/tickets', cp.url().replace(BASE, '') === '/dashboard/tickets', cp.url());
    await L.logoutApi(cp);
    await L.go(cp, '/events/ai-in-production-talk/register', { settle: 1500 });
    await L.clickText(cp, /In person/, 'label');
    await L.clickText(cp, /^Continue$/, 'button');
    await L.waitText(cp, /Registering as a guest/);
    await L.clickText(cp, /^Sign in$/, 'a');
    await L.sleep(2000);
    await L.typeInto(cp, '#email', U1);
    await L.typeInto(cp, '#password', PASS);
    await cp.keyboard.press('Enter');
    await cp.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => { });
    await L.sleep(1500);
    S.check('Register page "Sign in" link returns to the register page after login', /\/events\/ai-in-production-talk\/register/.test(cp.url()), cp.url());
    await L.logoutApi(cp);
    await L.go(cp, '/login?callbackUrl=' + encodeURIComponent('https://evil.example.com/steal'), { settle: 800 });
    await L.typeInto(cp, '#email', U1);
    await L.typeInto(cp, '#password', PASS);
    await cp.keyboard.press('Enter');
    await L.sleep(5000);
    S.check('Open redirect blocked: external callbackUrl stays on EventFlow', cp.url().startsWith(BASE), cp.url());
    await cp.ctx.close();

    }
    // ------------------------------------------------------------------ keyboard + labels
    if (!SKIP.includes('a11y')) {
    S.area('Accessibility: keyboard-only login, focus, labels');
    const kp = await L.person(browser);
    await L.go(kp, '/login', { settle: 1000 });
    const seq = [];
    for (let i = 0; i < 14; i++) {
      await kp.keyboard.press('Tab');
      const f = await focusInfo(kp);
      seq.push(f);
      if (f.id === 'email') break;
    }
    S.check('Tab reaches the email field', seq.some(f => f.id === 'email'), seq.map(f => f.id || f.text || f.tag).join(' > '));
    const skip = seq[0];
    S.note('First Tab stop on /login', JSON.stringify(skip));
    const missingRing = seq.filter(f => f.tag !== 'BODY' && !f.ring);
    S.check('Every focused control shows a visible focus indicator', missingRing.length === 0, JSON.stringify(missingRing.slice(0, 4)));
    await kp.keyboard.type(U1);
    await kp.keyboard.press('Tab');
    const pw = await focusInfo(kp);
    S.check('Tab from email goes straight to password', pw.id === 'password', JSON.stringify(pw));
    if (pw.id !== 'password') { await kp.keyboard.press('Tab'); S.note('Tab order on /login', 'email -> "' + pw.text + '" -> password'); }
    await kp.keyboard.type(PASS);
    await kp.keyboard.press('Enter');
    await kp.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => { });
    S.check('Enter in the password field submits and signs in (keyboard only)', (await L.api(kp, 'GET', '/api/auth/session')).json?.user?.email === U1, kp.url());
    await L.logoutApi(kp);
    for (const path of ['/login', '/signup', '/forgot-password', '/verify', '/events']) {
      await L.go(kp, path, { settle: 800 });
      const miss = await unlabeled(kp);
      S.check(`${path}: every form control has a label`, miss.length === 0, miss.join(' | '));
    }
    await L.go(kp, '/events/ai-in-production-talk/register', { settle: 1500 });
    await kp.keyboard.press('Tab');
    let radioReached = false;
    for (let i = 0; i < 25 && !radioReached; i++) { const f = await kp.evaluate(() => document.activeElement?.getAttribute('type')); if (f === 'radio') radioReached = true; else await kp.keyboard.press('Tab'); }
    S.check('Register: ticket choice reachable by keyboard', radioReached, '');
    if (radioReached) {
      const ring = await kp.evaluate(() => { const l = document.activeElement.closest('label'); const cs = getComputedStyle(l); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0; });
      S.check('Register: focused ticket shows a focus ring', ring, '');
      await kp.keyboard.press('ArrowDown');
      await kp.keyboard.press('Space');
      for (let i = 0; i < 25; i++) { await kp.keyboard.press('Tab'); const f = await focusInfo(kp); if (/^Continue/.test(f.text)) break; }
      await kp.keyboard.press('Enter');
      S.check('Register: Continue reachable and works by keyboard', await L.waitText(kp, /Full name/, 8000), '');
      const miss = await unlabeled(kp);
      S.check('Register details: every form control has a label', miss.length === 0, miss.join(' | '));
    }
    await kp.ctx.close();
    }
  } catch (e) {
    S.check('script crashed', false, e.stack);
  } finally {
    await browser.close();
    // Leave U1 (used by 03-attendee) but not the invite side effects
    try {
      const inv = await db.user.findUnique({ where: { email: INVITEE } });
      if (inv) await db.organizationMember.deleteMany({ where: { userId: inv.id } });
      await cleanOrgInvites(techClub.id);
      await db.notification.deleteMany({ where: { message: { contains: 'E2E-ATT Invitee' } } });
      await L.purgeUsers([INVITEE, UNVERIFIED, RESET, LOCK]);
    } catch (e) { console.error('cleanup in 02 failed', e.message); }
    await db.$disconnect();
  }
  process.exitCode = S.finish() ? 1 : 0;
})();
