# Organizer and door-volunteer end-to-end scripts

Re-runnable browser + API tests for club/college organizers (alice, ORG_ADMIN of Tech Club) and
door volunteers (an e2e COORDINATOR on a 390 px phone). They drive the real UI with
puppeteer-core and check that each action reflects everywhere: attendee side, public pages,
counters, analytics, audit log, notifications.

## Prerequisites

- Dev server on http://localhost:3000 (`BASE=...` to change), Postgres from `.env` (`DATABASE_URL`).
- Seed users `alice@test.local` / `bob@test.local` (password `Test@12345`).
- Chrome or Edge installed (paths in `lib.cjs`). One headless browser at a time; never runs `next build`.

## Run

```bash
node e2e/organizer/run-all.cjs          # cleanup, 01..09, cleanup; prints a pass/fail table
node e2e/organizer/run-all.cjs --keep   # keep the test data afterwards (inspect it, then run cleanup)
node e2e/organizer/cleanup.cjs          # delete everything the scripts created (idempotent)
```

Scripts can also run one at a time, in order (each needs the state of the previous ones):

| Script | Covers |
|---|---|
| `01-event-lifecycle.cjs` | 6-step wizard (validation, switches, cover PNG upload, free + paid tickets, capacity), draft, publish, `/events` and public page, register form fields, edit (dates must not shift, FAQs/sessions kept, edit from another time zone), duplicate, publish copy, cancel copy with a reason, public state of the cancelled copy |
| `02-registrations.cjs` | Public registration (approval required), organizer list for that event + KPIs, approve / reject (attendee side), Add participant (unknown email gets an account + ticket), paid ticket = "payments not configured", search, status filters, CSV export (formula escaping, scoped to the event) |
| `03-checkin.cjs` | Phone door flow as a Coordinator: hub, Expected / Checked in / Not arrived, ticket-number and registration-number lookup, manual check-in, repeat = already checked in, Undo, QR path (decoded text sent to the API), late-arrival ticket view, cross-event/tenant refusals, attendance CSV, attendee ticket, analytics, audit |
| `04-certificates.cjs` | Template creation, Pending -> Generate, attendee sees it, verify valid -> revoke -> revoked -> restore -> valid, resend, download uses the template, KPIs |
| `05-communications.cjs` | Draft save / edit / delete, send to one event (notification reaches the attendee, Sent history, audit), template use, announcements post (pinned), unpin/pin, delete, draft + Publish now |
| `06-members.cjs` | Invite existing account, change role, rank rules (Event Manager can't grant Org Admin), Event Manager at the door, remove -> loses access -> restore, pending invite -> cancel |
| `07-overview-analytics-audit.cjs` | Overview, org/event analytics, billing usage and audit log numbers vs the DB |
| `08-settings-website.cjs` | Every settings field saves and reloads, invalid GSTIN flagged, "Require approval" default pre-fills the wizard (values put back), website from template, editor change + save, preview, publish -> unpublish, media add/delete |
| `09-cross-tenant.cjs` | bob (Cultural Society) gets 403/404 on ~30 Tech Club actions, no leakage via own-org endpoints or pages; a plain attendee can't use organizer APIs |

## Data safety

- Everything created is prefixed: events `E2E-ORG ...` (Tech Club only), users `e2e-org-...@test.local`,
  template `E2E-ORG Template ...`, media `e2e-org-...`. Demo events, users and memberships are never changed.
- Ids are recorded in `%TEMP%/eventflow-e2e-organizer/state.json`; `cleanup.cjs` deletes the events and all their
  rows, the e2e users and their rows, audit rows written by alice / e2e users during the run, drafts and pending
  invites left in Tech Club's settings, the site config / media / template created, uploaded files, and puts
  Tech Club's profile and settings fields back from the snapshot taken at the start.
- If Tech Club's enterprise is over its plan's monthly event limit (the seed is: 8/5), 01 records that as a
  failure and inserts the exact payload the wizard sent so the rest of the lifecycle can still run through the app.
- If another tester turns maintenance mode on, the scripts wait (up to 5 min) instead of failing.

## Output

`%TEMP%/eventflow-e2e-organizer/`: `results/<script>.json` (every check with details, plus `ux` notes with
severity, page and suggested fix), `shots/*.png`, `downloads/*.csv`.

Not testable headless: the camera QR scanner (the scripts send the QR's decoded text to `/api/check-in`
exactly as the scanner does) and real email delivery (no SMTP locally; the code paths are checked).
