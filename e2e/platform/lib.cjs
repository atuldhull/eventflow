// Shared helpers for the platform (enterprise admin + super admin) e2e scripts.
// Plain Node (>= 18): global fetch, puppeteer-core and @prisma/client from the app's node_modules.
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

function readEnv(key) {
  if (process.env[key]) return process.env[key]
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
  const m = env.match(new RegExp(`^${key}=["']?([^"'\\r\\n]*)["']?`, 'm'))
  return m ? m[1] : ''
}

const DATABASE_URL = readEnv('DATABASE_URL')
const { PrismaClient } = require(path.join(ROOT, 'node_modules/@prisma/client'))
const bcrypt = require(path.join(ROOT, 'node_modules/bcryptjs'))

let _db
function db() {
  if (!_db) _db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
  return _db
}

// Demo accounts (never banned, demoted or deleted by these scripts)
const ACCOUNTS = {
  admin: ['admin@eventflow.com', 'Admin@123456'],
  alice: ['alice@test.local', 'Test@12345'],
  carol: ['carol@test.local', 'Test@12345'],
}
const E2E_PASSWORD = 'E2eEnt@12345'
const PREFIX = 'e2e-ent-' // emails, slugs
const NAME_PREFIX = 'E2E-ENT' // enterprise / org / event names

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const runId = () => Date.now().toString(36).slice(-6)

// ---------------------------------------------------------------------------
// HTTP client with a cookie jar (Auth.js credentials sign-in)
// ---------------------------------------------------------------------------
class Client {
  constructor(label = 'anon') {
    this.label = label
    this.jar = new Map()
  }
  cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
  }
  absorb(res) {
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const c of list) {
      const [pair, ...attrs] = c.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i).trim()
      const value = pair.slice(i + 1).trim()
      const a = attrs.join(';').toLowerCase()
      const expired = /max-age=0/.test(a) || (/expires=([^;]+)/.test(a) && new Date(a.match(/expires=([^;]+)/)[1]) < new Date())
      if (expired || value === '') this.jar.delete(name)
      else this.jar.set(name, value)
    }
  }
  async req(method, p, { json, form, body, headers = {}, timeout = 60000 } = {}) {
    const h = { ...headers }
    if (this.jar.size) h.cookie = this.cookieHeader()
    let payload = body
    if (json !== undefined) { h['content-type'] = 'application/json'; payload = JSON.stringify(json) }
    if (form !== undefined) { h['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString() }
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeout)
    let res
    try {
      res = await fetch(BASE + p, { method, headers: h, body: payload, redirect: 'manual', signal: ctl.signal })
    } finally { clearTimeout(timer) }
    this.absorb(res)
    const ct = res.headers.get('content-type') || ''
    const text = await res.text()
    let data = text
    if (ct.includes('application/json')) { try { data = JSON.parse(text) } catch { /* keep text */ } }
    return { status: res.status, headers: res.headers, body: data, text, location: res.headers.get('location') || '', ct }
  }
  get(p, o) { return this.req('GET', p, o) }
  post(p, json, o = {}) { return this.req('POST', p, { ...o, json }) }
  patch(p, json, o = {}) { return this.req('PATCH', p, { ...o, json }) }
  del(p, json, o = {}) { return this.req('DELETE', p, { ...o, json }) }

  /** Credentials sign-in. Returns { ok, code, location, user }. */
  async login(email, password) {
    this.jar.clear()
    const csrf = await this.get('/api/auth/csrf')
    const token = csrf.body && csrf.body.csrfToken
    const r = await this.req('POST', '/api/auth/callback/credentials', {
      form: { csrfToken: token, email, password, callbackUrl: `${BASE}/dashboard` },
    })
    const s = await this.get('/api/auth/session')
    const user = s.body && s.body.user ? s.body.user : null
    let code = ''
    try { code = new URL(r.location, BASE).searchParams.get('code') || new URL(r.location, BASE).searchParams.get('error') || '' } catch { /* */ }
    return { ok: !!user, code, location: r.location, status: r.status, user }
  }
  async session() {
    const s = await this.get('/api/auth/session')
    return s.body && s.body.user ? s.body.user : null
  }
}

async function loginAs(key, label) {
  const [email, pw] = ACCOUNTS[key]
  const c = new Client(label || key)
  const r = await c.login(email, pw)
  if (!r.ok) throw new Error(`login ${email} failed: ${r.code || r.status}`)
  c.user = r.user
  return c
}

async function loginEmail(email, password = E2E_PASSWORD) {
  const c = new Client(email)
  const r = await c.login(email, password)
  if (!r.ok) throw new Error(`login ${email} failed: ${r.code || r.status} ${r.location}`)
  c.user = r.user
  return c
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
function fmt(v) {
  if (v === undefined) return ''
  if (typeof v === 'string') return v.length > 300 ? v.slice(0, 300) + '…' : v
  try { const s = JSON.stringify(v); return s.length > 300 ? s.slice(0, 300) + '…' : s } catch { return String(v) }
}

function makeT(script) {
  const results = []
  let area = ''
  const t = {
    section(name) { area = name; console.log(`\n## ${name}`) },
    ok(name, cond, detail) {
      results.push({ area, name, pass: !!cond, detail: cond ? undefined : fmt(detail) })
      console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail !== undefined ? '  -- ' + fmt(detail) : ''}`)
      return !!cond
    },
    eq(name, actual, expected) {
      return t.ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
    },
    /** A finding that isn't a pass/fail check (ease-of-use, observation). */
    note(text) { results.push({ area, name: text, note: true }); console.log(`NOTE  ${text}`) },
    async step(name, fn) {
      try { return await fn() } catch (e) { t.ok(`${name} (threw)`, false, e && (e.stack || e.message)); return undefined }
    },
    results,
    save() {
      const pass = results.filter((r) => r.pass === true).length
      const fail = results.filter((r) => r.pass === false)
      const notes = results.filter((r) => r.note).length
      fs.writeFileSync(path.join(OUT, `${script}.json`), JSON.stringify({ script, at: new Date().toISOString(), pass, fail: fail.length, notes, results }, null, 2))
      console.log(`\n=== ${script}: ${pass} passed, ${fail.length} failed, ${notes} notes ===`)
      for (const f of fail) console.log(`  FAIL [${f.area}] ${f.name}${f.detail ? '  -- ' + f.detail : ''}`)
      return fail.length
    },
  }
  return t
}

// ---------------------------------------------------------------------------
// Registry of created things (cleanup also sweeps by prefix, so this is belt and braces)
// ---------------------------------------------------------------------------
const REG_FILE = path.join(OUT, 'registry.json')
const registry = {
  load() { try { return JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) } catch { return { uploads: [], auditLogIds: [], misc: [] } } },
  add(kind, value) {
    const r = registry.load()
    r[kind] = r[kind] || []
    if (!r[kind].includes(value)) r[kind].push(value)
    fs.writeFileSync(REG_FILE, JSON.stringify(r, null, 2))
  },
  clear() { try { fs.unlinkSync(REG_FILE) } catch { /* */ } },
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
async function createUser(tag, { name, role = 'USER', verified = true } = {}) {
  const email = `${PREFIX}${tag}@test.local`
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10)
  const u = await db().user.upsert({
    where: { email },
    update: { passwordHash, isBanned: false, isActive: true, deletedAt: null, role, name: name || `E2E Ent ${tag}`, emailVerified: verified ? new Date() : null },
    create: { email, passwordHash, name: name || `E2E Ent ${tag}`, role, emailVerified: verified ? new Date() : null },
  })
  return u
}

/** The minimal valid body for POST /api/admin/org/[orgId]/events. */
function eventBody(slug, title, { status = 'DRAFT', paid = false, daysAhead = 30 } = {}) {
  const start = new Date(Date.now() + daysAhead * 86400000)
  const end = new Date(start.getTime() + 3 * 3600000)
  return {
    title, slug,
    shortDescription: 'An end-to-end test event, safe to ignore.',
    description: 'This event was created by the platform end-to-end test suite and is deleted when the run finishes. '.repeat(1),
    type: 'IN_PERSON', category: 'TECHNICAL', tags: [], visibility: 'PUBLIC',
    startDate: start.toISOString(), endDate: end.toISOString(), timezone: 'Asia/Kolkata',
    isOnline: false, venue: 'E2E Hall', venueCity: 'Bengaluru',
    isPaid: paid, maxCapacity: 100,
    ticketTypes: [{ name: paid ? 'Paid pass' : 'General', price: paid ? 499 : 0, currency: 'INR', quantity: 100, maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }],
    status,
  }
}

// ---------------------------------------------------------------------------
// Cleanup: everything with the e2e-ent- / E2E-ENT prefix, plus registry entries
// ---------------------------------------------------------------------------
async function cleanupAll({ log = console.log } = {}) {
  const p = db()
  const users = await p.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
  const userIds = users.map((u) => u.id)
  const ents = await p.enterprise.findMany({ where: { OR: [{ slug: { startsWith: PREFIX } }, { name: { startsWith: NAME_PREFIX } }] }, select: { id: true, subscriptionId: true } })
  const entIds = ents.map((e) => e.id)
  const orgs = await p.organization.findMany({ where: { OR: [{ slug: { startsWith: PREFIX } }, { name: { startsWith: NAME_PREFIX } }, { enterpriseId: { in: entIds } }] }, select: { id: true } })
  const orgIds = orgs.map((o) => o.id)
  const events = await p.event.findMany({
    where: { OR: [{ slug: { startsWith: PREFIX } }, { title: { startsWith: NAME_PREFIX } }, { organizationId: { in: orgIds } }, { enterpriseId: { in: entIds } }, { createdById: { in: userIds } }] },
    select: { id: true },
  })
  const eventIds = events.map((e) => e.id)
  const allIds = [...userIds, ...entIds, ...orgIds, ...eventIds]
  const reg = registry.load()

  const counts = {}
  counts.auditLogs = (await p.auditLog.deleteMany({
    where: {
      OR: [
        { enterpriseId: { in: entIds } }, { organizationId: { in: orgIds } }, { eventId: { in: eventIds } },
        { entityId: { in: allIds } }, { userId: { in: userIds } },
        { id: { in: reg.auditLogIds || [] } },
        { description: { contains: NAME_PREFIX } }, { description: { contains: PREFIX } },
      ],
    },
  })).count
  counts.contactMessages = (await p.contactMessage.deleteMany({ where: { OR: [{ email: { startsWith: PREFIX } }, { subject: { startsWith: NAME_PREFIX } }] } })).count
  counts.notifications = (await p.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { eventId: { in: eventIds } }, { senderId: { in: userIds } }] } })).count
  counts.payments = (await p.payment.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] } })).count
  counts.tickets = (await p.ticket.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] } }).catch(() => ({ count: 0 }))).count
  counts.registrations = (await p.registration.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] } })).count
  counts.events = (await p.event.deleteMany({ where: { id: { in: eventIds } } })).count
  counts.subscriptions = (await p.subscription.deleteMany({ where: { OR: [{ id: { in: ents.map((e) => e.subscriptionId).filter(Boolean) } }, { organizationId: { in: orgIds } }] } })).count
  counts.orgs = (await p.organization.deleteMany({ where: { id: { in: orgIds } } })).count
  counts.enterprises = (await p.enterprise.deleteMany({ where: { id: { in: entIds } } })).count
  // Memberships of e2e users in demo workspaces (should be none) go with the user (cascade)
  counts.users = (await p.user.deleteMany({ where: { id: { in: userIds } } })).count
  let files = 0
  for (const f of reg.uploads || []) {
    const fp = path.join(ROOT, 'uploads', path.basename(f))
    try { fs.unlinkSync(fp); files++ } catch { /* already gone */ }
  }
  counts.uploadFiles = files
  registry.clear()
  log(`cleanup: ${JSON.stringify(counts)}`)
  return counts
}

// ---------------------------------------------------------------------------
// Browser (ONE at a time; always closed in finally)
// ---------------------------------------------------------------------------
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))

async function withBrowser(fn) {
  const puppeteer = require(path.join(ROOT, 'node_modules/puppeteer-core'))
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu', '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=256'] })
  try { return await fn(browser) } finally { await browser.close().catch(() => {}) }
}

/** A fresh browser context signed in as `email`. */
async function browserLogin(browser, email, password, { width = 1440 } = {}) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await setWidth(page, width)
  page.setDefaultTimeout(30000)
  page.__errors = []
  page.on('pageerror', (e) => page.__errors.push(String(e.message).slice(0, 200)))
  await page.goto(BASE + '/api/auth/csrf')
  const who = await page.evaluate(async ([e, pw]) => {
    const { csrfToken } = await (await fetch('/api/auth/csrf')).json()
    await fetch('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, email: e, password: pw, json: 'true' }) })
    return (await (await fetch('/api/auth/session')).json())?.user?.email
  }, [email, password])
  if (who !== email) throw new Error(`browser login failed for ${email}`)
  return { ctx, page }
}

async function setWidth(page, w) {
  await page.setViewport({ width: w, height: w >= 1024 ? 900 : 844, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 })
}

const SHOTS = process.env.E2E_SHOTS || path.join(OUT, 'shots')
async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true })
  const file = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false }).catch(() => {})
  return file
}

/** Wait until the page body contains `text` (string or RegExp). */
async function waitText(page, text, timeout = 15000) {
  const src = text instanceof RegExp ? { re: text.source, flags: text.flags } : { s: text }
  try {
    await page.waitForFunction((q) => {
      const body = document.body ? document.body.innerText : ''
      return q.re ? new RegExp(q.re, q.flags).test(body) : body.includes(q.s)
    }, { timeout }, src)
    return true
  } catch { return false }
}

/** Click the first visible element whose text matches. */
async function clickText(page, selector, text) {
  const ok = await page.evaluate((sel, txt) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || e.getClientRects().length)
    const el = els.find((e) => (e.innerText || e.textContent || '').trim().toLowerCase().includes(txt.toLowerCase()) || (e.getAttribute('aria-label') || '').toLowerCase().includes(txt.toLowerCase()))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true }
    return false
  }, selector, text)
  return ok
}

/** Like clickText, but with a real mouse click (Base UI tabs/options need pointer events). */
async function clickReal(page, selector, text) {
  for (const h of await page.$$(selector)) {
    const ok = await h.evaluate((e, txt) => (e.offsetParent !== null || e.getClientRects().length) && ((e.innerText || '').trim().toLowerCase().includes(txt.toLowerCase())), text)
    if (ok) { await h.click(); return true }
  }
  return false
}

async function overflowX(page) {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth)
}

async function serverUp() {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000)
    const r = await fetch(BASE + '/api/health', { signal: ctl.signal }); clearTimeout(t)
    return r.status === 200
  } catch { return false }
}

/** A tiny valid PNG (1x1) for upload tests. */
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

async function uploadPng(client) {
  const fd = new FormData()
  fd.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'logo.png')
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: fd, headers: { cookie: client.cookieHeader() } })
  const body = await res.json().catch(() => null)
  if (body && body.data && body.data.filename) registry.add('uploads', body.data.filename)
  return { status: res.status, body }
}

/** Parse a CSV body (all cells quoted) into rows of strings. */
function parseCsv(text) {
  const s = text.replace(/^\uFEFF/, '')
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') q = false; else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

module.exports = {
  ROOT, BASE, OUT, db, ACCOUNTS, E2E_PASSWORD, PREFIX, NAME_PREFIX, sleep, runId,
  Client, loginAs, loginEmail, makeT, registry, createUser, eventBody, cleanupAll,
  withBrowser, browserLogin, setWidth, shot, waitText, clickText, clickReal, overflowX, serverUp, uploadPng, parseCsv, PNG_1x1,
}
