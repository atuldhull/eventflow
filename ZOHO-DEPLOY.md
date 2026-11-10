# Putting EventFlow live on Zoho Catalyst

This is the Zoho version of `DEPLOY.md`. EventFlow runs as a Docker image on
**Catalyst AppSail**. The pieces Catalyst doesn't provide come from free services:

| Piece | Where | Cost to start |
|---|---|---|
| The app | Zoho Catalyst AppSail (Docker image) | Free tier / trial credit |
| Database (PostgreSQL) | **Neon** (neon.tech) | Free plan |
| The 5-minute seat release + hourly reminders | **cron-job.org** | Free |
| Uploaded images (event covers, logos) | **Cloudflare R2** (S3-compatible) | Free up to 10 GB |
| App emails | Zoho ZeptoMail (SMTP) | Free credits |

Why not Catalyst's own database? Catalyst's Data Store isn't PostgreSQL, and EventFlow's
44 tables go through Prisma, which needs a real PostgreSQL. Catalyst can talk to an outside
database, so Neon it is.

Run every command below in **PowerShell** on your PC, from `D:\eventflow`, unless it says otherwise.

---

## 1. Database on Neon (10 minutes)

1. Sign up at **neon.tech**. Create a project: name `eventflow`, Postgres 16, region
   **AWS Asia Pacific (Singapore)** (the closest to India).
2. On the dashboard click **Connect**. Untick **Connection pooling** and copy the string. It looks like
   `postgresql://neondb_owner:xxxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Create the tables:
   ```powershell
   $env:DATABASE_URL = "<the Neon string>"
   npx prisma migrate deploy
   ```
   It should end with `All migrations have been successfully applied.`
4. Make your own platform-admin account. First sign up on the live site (step 5), then run:
   ```powershell
   node scripts/make-super-admin.mjs you@yourmail.com
   ```
   (same PowerShell window, so `DATABASE_URL` still points at Neon)
5. Close that PowerShell window afterwards, so you don't run anything else against the live database by accident.

## 2. Zoho Catalyst project and CLI (10 minutes)

1. Sign in at **catalyst.zoho.in** (the `.in` address keeps data in India). Create a project: `EventFlow`.
2. Install the Catalyst command line and sign in:
   ```powershell
   npm install -g zcatalyst-cli
   catalyst login
   ```
3. Make a small folder for the Catalyst project (it only holds Catalyst's config, not the code):
   ```powershell
   mkdir D:\eventflow-zoho; cd D:\eventflow-zoho
   catalyst init
   ```
   Choose your `EventFlow` project. When it asks for features, pick **AppSail**, then
   **Docker Image**, then **Docker Image** again, select `eventflow:live` (build it first, step 3),
   and name the service `eventflow`.

## 3. Build the image (5–10 minutes)

The site's address is baked into the build. The first time, you don't know the AppSail address
yet, so build once, deploy, copy the address it prints, then build and deploy again with it.
(With your own domain, put the domain in straight away.)

```powershell
cd D:\eventflow
docker build --target runner --platform linux/amd64 `
  --build-arg NEXT_PUBLIC_APP_URL=https://<your address> `
  --build-arg NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.in `
  --build-arg NEXT_PUBLIC_PRIVACY_EMAIL=privacy@yourdomain.in `
  --build-arg NEXT_PUBLIC_GRIEVANCE_OFFICER="Your Name" `
  --build-arg NEXT_PUBLIC_LEGAL_ENTITY="Your business name" `
  --build-arg NEXT_PUBLIC_LEGAL_JURISDICTION="Bengaluru, Karnataka" `
  -t eventflow:live .
```

## 4. Settings in the Catalyst console

Open **Catalyst console → your project → Serverless → AppSail → eventflow → Configurations**.

- **Memory:** the default 512 MB is enough (tested 2026-11-10: about 135 MB in use after login and browsing). Raise it only if the logs show the app restarting.
- **Environment variables** (the app refuses to start in production if a required one is missing,
  and the log says which):

| Name | Value |
|---|---|
| `DATABASE_URL` | the Neon string from step 1 |
| `NEXTAUTH_SECRET` | 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `NEXTAUTH_URL` | `https://<your address>` |
| `AUTH_TRUST_HOST` | `true` (Catalyst sits in front of the app) |
| `NEXT_PUBLIC_APP_URL` | `https://<your address>` (same as the build) |
| `TICKET_SECRET` | another 32+ random characters (never change it later: it signs every ticket QR) |
| `CRON_SECRET` | another random string (used in step 6) |
| `EMAIL_FROM` | `EventFlow <noreply@yourdomain.in>` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | from ZeptoMail: `smtp.zeptomail.in`, `587`, `emailapikey`, your token |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | when you have Razorpay (test keys first) |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | from step 7 |
| `SENTRY_DSN` | optional, for error alerts |

## 5. Deploy

```powershell
cd D:\eventflow-zoho
catalyst deploy appsail
```

It prints the app's address. Open `https://<address>/api/health`: it should say the database is OK.
First time only: rebuild with that address (step 3) and deploy again.

## 6. The timer (cron-job.org, 5 minutes)

The app frees seats from unpaid checkouts and sends reminders only when something calls it.
At **cron-job.org** (free account) create two jobs:

| Job | URL | Schedule | Header |
|---|---|---|---|
| Release seats | `https://<address>/api/cron/release-holds` | every 5 minutes | `Authorization: Bearer <CRON_SECRET>` |
| Reminders | `https://<address>/api/cron/reminders` | every hour | the same header |

Each run should show status 200.

## 7. Uploaded images (Cloudflare R2)

Catalyst's disk is wiped when the app restarts, so uploads must live in a bucket.

1. Cloudflare dashboard → **R2** → create a bucket `eventflow-uploads` (it can stay private;
   the app serves the files itself).
2. **Manage API tokens** → create a token with **Object Read & Write** on that bucket.
3. Put these in the AppSail environment variables, then redeploy:
   `S3_BUCKET=eventflow-uploads`, `S3_REGION=auto`,
   `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, and the token's two keys.

## 8. Your own domain (optional)

Catalyst console → **Cloud Scale → Domain Mapping** → add `events.yourdomain.in` and follow its DNS steps
(at GoDaddy: add the record it shows). Then change `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the
domain, rebuild (step 3) and deploy.

## Backups

Neon keeps a restore history (on the free plan, a short window; see your plan). For a copy you own,
once a week:
```powershell
docker run --rm postgres:16 pg_dump "<the Neon string>" > D:\eventflow-backups\db-$(Get-Date -f yyyy-MM-dd).sql
```

## Updating to a new version

```powershell
cd D:\eventflow
$env:DATABASE_URL = "<the Neon string>"; npx prisma migrate deploy   # only if prisma/migrations changed
docker build ... -t eventflow:live .        # the same command as step 3
cd D:\eventflow-zoho; catalyst deploy appsail
```
