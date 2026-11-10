# Platform e2e: enterprise admins + super admin

Re-runnable end-to-end checks for the two "platform" personas: a university events office
running many clubs (Enterprise Admin) and the platform operator (Super Admin). Each script
builds its own temporary data, checks that every action works **and shows up everywhere it
should** (DB, other roles, public pages, counters, audit log), then deletes what it created.

## Before you run

- Dev server on http://localhost:3000 (`BASE=` to change), Postgres from `.env` (`DATABASE_URL`).
- Demo accounts seeded: `admin@eventflow.com`, `alice@test.local`, `carol@test.local`.
- Chrome or Edge installed (05, 06 and the last part of 04 drive one headless browser).
- Run the scripts **one at a time**: each one ends with a sweep of every `e2e-ent-` record.

## Scripts

| Script | What it covers | Time |
|---|---|---|
| `01-enterprise.cjs` | Enterprise admin API: create/edit/delete clubs, logo upload, members (invite, role, remove, Active/Removed, search, owner protection), settings + branding (customDomain only via DNS), approval flow (pending -> not public -> approve/reject), registrations/payments/audit search + formula-safe CSV, dashboard + club numbers vs DB, billing messages, owner delete | ~1 min |
| `02-super-admin.cjs` | Users KPIs, role change, ban/unban (sign-in refused, KPIs, audit), self-ban/demote blocked, enterprises verify / deactivate (members lose access) / delete (typed, soft), events + dashboard + subscriptions totals, messages, audit | ~1 min |
| `03-platform-settings.cjs` | **Global** settings: test email, registration off, min password length, payments off, social toggles, maintenance mode. Original values are restored in `finally` | ~1.5 min |
| `04-cross-role.cjs` | alice (org admin) and carol (user) vs every enterprise + super-admin page and API (reads and writes), tenant isolation, middleware (public /offline, 404, login redirects, 401 JSON, headers) | ~1 min |
| `05-ui-enterprise.cjs` | Browser walk as a university Enterprise Admin, 1440 + 390 | ~4 min |
| `06-ui-super-admin.cjs` | Browser walk as the operator, 1440 + 390 | ~3 min |
| `07-session-refresh.cjs` | A ban / role change reaching an already signed-in session (waits 5 min 20 s) | ~6 min |
| `cleanup.cjs` | Deletes every leftover `e2e-ent-` / `E2E-ENT` record and uploaded file; restores platform settings from `out/settings-backup.json` if 03 was interrupted | seconds |

```bash
node e2e/platform/01-enterprise.cjs
node e2e/platform/02-super-admin.cjs
node e2e/platform/03-platform-settings.cjs   # changes GLOBAL settings for ~1 min, then restores
node e2e/platform/04-cross-role.cjs
node e2e/platform/05-ui-enterprise.cjs
node e2e/platform/06-ui-super-admin.cjs
node e2e/platform/07-session-refresh.cjs
node e2e/platform/cleanup.cjs                # always safe to run
```

Exit code is the number of failed checks capped at 1 (0 = all passed). Results land in
`out/<script>.json` and screenshots in `out/shots/`. `E2E_KEEP=1` skips the cleanup so you can
look at the data (run `cleanup.cjs` afterwards).

## Data safety

- Only `e2e-ent-*@test.local` users and `E2E-ENT …` enterprises/orgs/events are created,
  changed, banned or deleted. Demo users, Demo University and its clubs are only read
  (04 aims every write at a temporary enterprise and checks nothing changed).
- 03 writes a backup of the original settings first, restores them in `finally`, and removes
  the settings row again if there was none before. Maintenance mode stays on for ~35 s
  (the middleware caches settings for up to 30 s), so warn other testers first.
- Audit entries about the temporary data (and the settings toggles of 03) are deleted too.

## Files

- `lib.cjs`: HTTP client with a cookie jar + Auth.js sign-in, result recorder, fixtures,
  `cleanupAll()`, browser helpers (one browser, always closed).
