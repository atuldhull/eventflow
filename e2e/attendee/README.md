# Attendee / guest end-to-end scripts

Re-runnable checks of what guests and students (attendees) do in EventFlow, and of how
each action shows up elsewhere: the organizer's lists and counters, dashboard counts,
notifications and statuses. They drive a headless Chrome (puppeteer-core) against the
running dev server and read or prepare data with Prisma.

## Before you run

- Dev server running at http://localhost:3000 (`BASE=...` to change). Don't run `next build`.
- Postgres up (Docker, port 5433). The scripts read `DATABASE_URL` from `D:\eventflow\.env`.
- Chrome or Edge installed (`CHROME_PATH=...` to point at another one).
- Low RAM: run **one script at a time**. Each script opens one browser and closes it.
- For `06-payments-sim.cjs` only: in `.env` set `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` to any
  local test strings and leave `RAZORPAY_KEY_ID` empty (the script plays Razorpay by signing with them).
  Emails are checked when a mail catcher answers on localhost (JSON inbox at http://localhost:8025/messages).

## Run

From `D:\eventflow`:

```
node e2e/attendee/01-guest.cjs          # guest: landing, /events filters, event page, guest free registration, paid needs sign-in, /verify, org/enterprise pages, 404s
node e2e/attendee/02-auth.cjs           # signup steps + OTP, first login, guest takeover, org invite accepted at signup, unverified login, forgot/reset, lockout, callbackUrl, keyboard + labels
node e2e/attendee/03-attendee.cjs       # register -> ticket/dashboard/notification/organizer view, QR at the door, ticket dialog (QR, PDF, .ics), transfer, cancel, paid seat hold, saved, notifications, profile, settings, password change
node e2e/attendee/04-certificates.cjs   # alice issues a certificate -> student list, PDF, verify valid; revoke -> verify revoked
node e2e/attendee/05-pwa.cjs            # manifest, icons, service worker, tickets offline, dark-mode spot checks
node e2e/attendee/06-payments-sim.cjs   # paid tickets with simulated money (no Razorpay account): coupon, signed checkout callback, forged/replayed signatures, webhook-only capture, wrong amount, refund, failed payment + retry, expired hold + cron, organizer revenue, plan upgrade can't be faked, receipt/refund emails
node e2e/attendee/cleanup.cjs           # ALWAYS run last: removes all test data and checks counters
node e2e/attendee/cleanup.cjs --dry     # list what would be removed
```

Run 01 before 02 if you want the "guest takes over their registration" check (01 leaves a
passwordless guest with a ticket; 02 signs that email up).

Options (environment variables):

- `QUICK=1` (01): skip the slow all-pages sweep at the start.
- `SKIP=...` (02, 03): skip sections, e.g. `SKIP=signup,guest,invite` for 02 or
  `SKIP=saved,profile` for 03 (section names are listed at the top of each script; in 03
  keep `register` when running scan/dialog/transfer).
- `LONG=1` (03): wait up to ~6 min to confirm that another device is signed out after a
  password change (sessions re-check the account every 5 minutes).

If the dev server starts answering signed-in `/api/*` calls with its HTML 404 page (it lost
its route table, e.g. after a memory-limit restart), the helper stops that section with an
`ENVIRONMENT:` error instead of reporting app bugs. Restart the dev server and re-run.

Each script prints PASS / FAIL / NOTE lines and a summary, and exits 1 if anything failed.

## Output

Results and screenshots go to `%TEMP%\eventflow-e2e-attendee\` (override with `E2E_OUT`):

- `<script>-results.json`: every check with its detail
- `shots\*.png`: screenshots (mostly 390 px phone, some 1440 px and dark mode)
- `counters.json`: event seat / ticket stock / coupon counts taken before the first run;
  `cleanup.cjs` compares against it and deletes it once everything is back

## Test data and safety

- Only accounts with emails starting `e2e-att-` are created or changed. Demo accounts
  (alice, bob, carol) are only signed in to; their passwords and data are never changed.
- Seats, ticket stock and coupon uses held by test registrations are given back before the
  test users are deleted, using the app's own rules (`purgeUsers` in `lib.cjs`).
- Temporary items: an unlisted event `e2e-att-terms-event` (01, deleted at the end of the
  script), a Tech Club certificate template "E2E-ATT template" (04, only if the org has
  none; deleted at the end), a pending invite for `e2e-att-invite@test.local` in Tech Club
  settings (02, removed at the end).
- The login lockout test (02) leaves an in-memory lock on `e2e-att-lock@test.local` for
  15 minutes; that account is deleted anyway.
- If another tester switches on maintenance mode, the scripts wait (up to ~4 min) instead
  of failing every page.
- No payments are made: with empty Razorpay keys the paid flow stops at "payments not
  configured" and the 15-minute seat hold is released by cancelling.
