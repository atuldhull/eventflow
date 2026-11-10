# Deploying EventFlow

One server running Docker is enough for a pilot with a few colleges. This guide sets up
EventFlow on HTTPS, with email, payments, error alerts, the 5-minute scheduler and daily
backups.

**What you need**
- A server with 2 GB RAM and Docker installed, for example Hetzner CX22, DigitalOcean,
  AWS Lightsail Mumbai or a college server.
- A domain or subdomain, such as `events.yourcollege.in`.
- Accounts: Razorpay, Resend (or any SMTP provider), and Sentry (free).

---

## 1. Point the domain at the server

At your domain registrar (or Cloudflare), add an **A record**. Set the name to
`events` (or `@`) and the value to the server's IP address. Wait until
`ping events.yourcollege.in` shows that IP.

## 2. Get the code and settings onto the server

```sh
git clone <your repo> eventflow && cd eventflow
cp .env.example .env.local      # the app's settings
nano .env.local
```

Fill in at least the settings below. The app refuses to start in production without the
required ones, and it prints which ones are missing.

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` | `https://events.yourcollege.in` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `events.yourcollege.in` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://eventflow:<POSTGRES_PASSWORD>@postgres:5432/eventflow?schema=public` |
| `NEXTAUTH_SECRET`, `TICKET_SECRET`, `CRON_SECRET` | each one from `openssl rand -hex 32` (all different) |
| `EMAIL_FROM` | `EventFlow <tickets@yourdomain.in>` |
| `RESEND_API_KEY` (or `SMTP_*`) | see step 4 |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | see step 5 |
| `SENTRY_DSN` and/or `ALERT_WEBHOOK_URL` | see step 6 |

Then create `.env` next to it. Docker Compose reads this file itself:

```sh
DOMAIN=events.yourcollege.in
POSTGRES_PASSWORD=<long random, the same as in DATABASE_URL>
CRON_SECRET=<the same as in .env.local>
# baked into the build: copy each NEXT_PUBLIC_ line from .env.local here too
NEXT_PUBLIC_APP_URL=https://events.yourcollege.in
NEXT_PUBLIC_LEGAL_ENTITY=...
NEXT_PUBLIC_GRIEVANCE_OFFICER=...
NEXT_PUBLIC_PRIVACY_EMAIL=...
NEXT_PUBLIC_SUPPORT_EMAIL=...
```

The `NEXT_PUBLIC_` values are written into the app when it is built, so they must be in this `.env` (which the build reads), not only in `.env.local`. After changing one, rebuild with `docker compose up -d --build`.

Keep both files private (`chmod 600 .env .env.local`). Never commit them.

## 3. Start it

```sh
docker compose --profile https up -d --build
docker compose ps          # app "healthy", migrate "exited (0)"
docker compose logs -f app
```

This starts:
- **migrate**: brings the database up to date, then exits. It runs before every start.
- **app**: EventFlow. Only the server itself can reach port 3000.
- **caddy**: HTTPS on ports 80/443. It gets a free Let's Encrypt certificate for `DOMAIN`.
- **scheduler**: every 5 minutes it releases seats from checkouts that weren't paid. Every
  hour it sends reminders.
- **backup**: a daily database dump and uploads archive in `./backups`, kept for 14 days.

Open `https://events.yourcollege.in`. `/api/health` should show `"status":"healthy"`.

**First platform admin.** Sign up on the site with your own email, then run:

```sh
docker compose run --rm migrate node scripts/make-super-admin.mjs you@yourdomain.in
```

Sign out and back in to see `/super-admin`. **Don't run the seed** in production; it
creates demo accounts.

## 4. Email that doesn't land in spam

Ticket emails, sign-in codes and receipts must come from your own domain.

1. Create a [Resend](https://resend.com) account (the free tier is 3,000 emails a month).
   Go to **Domains → Add domain** and enter `yourdomain.in`. A subdomain such as
   `mail.yourdomain.in` also works.
2. Resend shows some DNS records. Add every one of them at your registrar:
   - **SPF**: a TXT record that allows Resend to send for you.
   - **DKIM**: a TXT record that signs every email.
   - **DMARC**: add it yourself as a TXT record named `_dmarc` with the value
     `v=DMARC1; p=none; rua=mailto:you@yourdomain.in`. Once mail is arriving well, raise it
     to `p=quarantine`.
3. When Resend shows the domain as **Verified**, put the API key in `RESEND_API_KEY`. Set
   `EMAIL_FROM` to an address on that domain.
4. Check it: Super admin → Settings → **Send test email**, then look at the message headers
   in Gmail ("Show original"). SPF, DKIM and DMARC should all show **PASS**.

Using SMTP instead (Zoho, Google Workspace, Amazon SES)? Set `SMTP_HOST`, `SMTP_PORT`
(587, or 465 for SSL), `SMTP_USER` and `SMTP_PASS`. You still add the SPF/DKIM records
your provider gives you.

## 5. Payments (Razorpay)

1. At [dashboard.razorpay.com](https://dashboard.razorpay.com), start in **Test mode**. Go
   to Settings → API Keys → Generate. Put the two values in `RAZORPAY_KEY_ID` and
   `RAZORPAY_KEY_SECRET`.
2. Go to Settings → **Webhooks** → Add:
   - URL: `https://events.yourcollege.in/api/webhooks/razorpay`
   - Events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`
   - Choose a secret and put the same value in `RAZORPAY_WEBHOOK_SECRET`.
3. Restart with `docker compose up -d`, then buy a ticket to a paid test event. Use card
   `4111 1111 1111 1111` with any future date and any CVV, or UPI `success@razorpay`.
4. Then try a refund from the organizer's **Payments** page. The buyer should get a
   "Refund processed" email, and Razorpay should show the refund.
5. After Razorpay approves your KYC, switch to **Live mode** and replace the keys and the
   webhook secret with the live ones.

## 6. Error alerts and uptime

- **Sentry**:
  1. Create a free project of type "Node.js" at [sentry.io](https://sentry.io).
  2. Copy the DSN (Settings → Client Keys) into `SENTRY_DSN`.
  3. Server crashes, browser crashes and failed emails will arrive there. The same error is
     sent at most once every 5 minutes.
- **Chat alerts (optional)**: put a Slack incoming-webhook URL or a Discord channel webhook
  URL in `ALERT_WEBHOOK_URL`.
- **Uptime**: in [UptimeRobot](https://uptimerobot.com) (free) or Better Stack, add an HTTP
  monitor:
  - URL: `https://events.yourcollege.in/api/health`, checked every 5 minutes.
  - Alert when the response doesn't contain `"healthy"`.

## 7. Backups

`./backups` gets a new `db-YYYY-MM-DD.sql.gz` and `uploads-YYYY-MM-DD.tar.gz` every day.
**Also copy them off the server**, or a lost server takes the backups with it. For
example, use [rclone](https://rclone.org) to Google Drive or Cloudflare R2 from the host's
crontab:

```sh
30 3 * * * rclone copy /path/to/eventflow/backups remote:eventflow-backups --max-age 48h
```

**Restore** (this replaces the current data):

```sh
gunzip -c backups/db-2026-11-10.sql.gz | docker compose exec -T postgres psql -U eventflow -d eventflow
docker compose run --rm -v "$PWD/backups:/b" app sh -c "tar -xzf /b/uploads-2026-11-10.tar.gz -C /app/uploads"
```

Test a restore once, before you need it.

## 8. Updating

```sh
git pull
docker compose --profile https up -d --build   # database migrations run first, automatically
```

---

## Running more than one app server

The setup above is a single server. To run several app servers behind a load balancer:

- Set `REDIS_URL`, so sign-in limits and other rate limits are shared between servers.
- Set the `S3_*` settings, so uploads live in S3, Cloudflare R2 or Backblaze B2 instead of
  one server's disk.
- Run the scheduler and backup containers on one machine only.
- Use a managed Postgres (with its own backups) instead of the `postgres` container.

## Quick reference

| Task | Command |
|---|---|
| Logs | `docker compose logs -f app` (also `scheduler`, `backup`, `caddy`) |
| Restart after editing `.env.local` | `docker compose up -d` |
| Database shell | `docker compose exec postgres psql -U eventflow` |
| Run the seat-release job now | `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/release-holds` |
| Maintenance page on/off | Super admin → Settings, or `MAINTENANCE_MODE=true` |
