<p align="center">
  <img src="docs/brand/banner.svg" alt="EventFlow: events people actually show up for" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/atuldhull/eventflow/actions/workflows/ci.yml"><img src="https://github.com/atuldhull/eventflow/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/unit_tests-788_passing-FFF21A?style=flat-square&labelColor=171717" alt="Unit tests" />
  <img src="https://img.shields.io/badge/Next.js-16.2-A66BFF?style=flat-square&labelColor=171717" alt="Next.js 16.2" />
  <img src="https://img.shields.io/badge/Postgres-Prisma_6-A66BFF?style=flat-square&labelColor=171717" alt="PostgreSQL with Prisma 6" />
  <img src="https://img.shields.io/badge/deploy-Docker-FFF21A?style=flat-square&labelColor=171717" alt="Docker" />
</p>

<p align="center">
  <b>Listing, tickets, payments, door check-in and certificates, in one app.</b><br />
  Built for colleges and companies that run a lot of events and are tired of gluing five tools together.
</p>

---

## What it is

EventFlow is a multi-tenant event platform. An **enterprise** (say, a university) owns
**organizations** (its clubs and departments), and each organization runs **events** and gets
its own public website, which it edits with a drag-and-drop builder.

Attendees register in three steps, pay through Razorpay, and carry a signed QR ticket that
stays on their phone even without signal. Organizers scan people in with a phone camera,
refund with one click (or refund a whole cancelled event at once), and send certificates
afterwards.

**Status:** not live yet. The production Docker image is built and tested the way Zoho
Catalyst would run it, and it passes. See [Deploying](#deploying).

<table>
  <tr>
    <td width="66%"><img src="docs/screenshots/landing-dark-1440-top.png" alt="Landing page, dark theme" /></td>
    <td width="34%" rowspan="2"><img src="docs/screenshots/landing-dark-390-top.png" alt="Landing page on a phone" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/landing-light-1440-top.png" alt="Landing page, light theme" /></td>
  </tr>
</table>

## What's in the box

| | |
|---|---|
| **Events** | Six-step wizard, several ticket types, coupons, custom registration questions, team registration with invite codes, drafts, preview, optional approval by the enterprise |
| **Tickets** | HMAC-signed QR codes, a PDF and calendar file for each, transfer to someone else (the old QR dies), saved on the phone for offline use |
| **Payments** | Razorpay with the price worked out on the server, GST, a 15-minute seat hold during checkout, partial and full refunds, *Refund all* for cancelled events |
| **Door** | Camera QR scanner, manual search, live counts, undo |
| **After** | Certificate templates, bulk issue, public verification page, feedback forms |
| **Websites** | 19 sections, 12 add-on modules (live quiz, poll, leaderboard, gallery, blog, merch...), 6 templates, served on each organization's subdomain or its own domain |
| **Admin** | 9 roles and 71 permissions, worked out per enterprise, organization and event; audit log; CSV exports; super-admin console; maintenance mode |
| **Your data** | Attendees can download everything held about them, or delete their account |
| **API** | `/api/v1` with scoped API keys and per-key rate limits, plus signed webhooks |

## The interesting part: authorization

The hard problem in a system shaped like this isn't CRUD, it's making sure an admin of one
organization can never touch another's data. Getting that wrong is the whole ballgame.

`authorize()` (`src/lib/authorization.ts`) resolves a user's permissions *per entity*: your role
in enterprise X says nothing about your rights in organization Y. It checks against the 71
permissions in `src/lib/permissions.ts`, and every admin route calls it.

I learned the hard way that "every route calls it" is a promise a human keeps badly. Three admin
routes had no check at all: `events/check-slug` let any logged-in user probe another org's
event slugs, and `billing/invoices` checked that you were logged in but never that the invoice
was yours. Both are fixed, and the boundary is now pinned by tests rather than by my memory. An
org-A admin being refused in org B is an assertion, not a convention.

Same story with billing. The premium-template gate was switched off in the UI with a literal
`|| true`, and the API behind it had no plan check either, so a free org could apply any paid
template by POSTing to the endpoint directly. The check now lives on the server and fails closed.

**Known gaps, so you don't have to find them:** there's no Postgres row-level security. Tenant
scoping is enforced in application code, which is why the tests matter. Offline *scanning* at
the door isn't wired up yet (offline *tickets* are).

## Stack

| | |
|---|---|
| App | Next.js 16.2 (App Router, Turbopack), React 19, TypeScript strict |
| Data | PostgreSQL 16 through Prisma 6, 44 models, real migrations |
| Auth | NextAuth v5: email and password, email codes, optional Google and Microsoft |
| UI | Tailwind CSS v4, shadcn/ui, Framer Motion 12, Bricolage Grotesque + IBM Plex |
| Payments | Razorpay |
| Email | Resend, or any SMTP server (Zoho ZeptoMail works) |
| Files | Local disk, or S3-compatible storage such as Cloudflare R2 |
| Tests | Vitest (unit and database), Puppeteer end-to-end checks, GitHub Actions |

## Run it locally

You need **Node 22**, **pnpm** and **Docker** (for the database).

```bash
pnpm install
cp .env.example .env.local          # set DATABASE_URL to postgresql://eventflow:eventflow_dev@localhost:5432/eventflow,
                                    # and NEXTAUTH_SECRET + TICKET_SECRET (32+ random chars each)
docker compose up -d postgres       # PostgreSQL on localhost:5432
pnpm exec prisma migrate deploy     # create the tables
pnpm exec prisma db seed            # templates, modules and a first admin
pnpm dev                            # http://localhost:3000
```

Razorpay, email and Google/Microsoft keys are optional while developing. Never commit `.env`
or `.env.local`; both are git-ignored.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | Unit tests |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `npx tsx scripts/build-docs.ts` | Rebuild the two PDF guides |
| `pnpm exec prisma studio` | Look inside the database |

## Deploying

Everything ships as one Docker image. Two written guides, both step by step:

- **[DEPLOY.md](./DEPLOY.md)**: your own server (for example a DigitalOcean droplet) with Docker Compose, automatic HTTPS, timed jobs and nightly backups.
- **[ZOHO-DEPLOY.md](./ZOHO-DEPLOY.md)**: Zoho Catalyst AppSail, with Neon for the database, cron-job.org for the timer and Cloudflare R2 for uploads.

## Guides

| | |
|---|---|
| [**User Guide**](./docs/user-guide.pdf) | For attendees and first-time organizers: signing up, registering, tickets, running an event |
| [**Admin Reference**](./docs/admin-reference.pdf) | Every admin page, the nine roles, and a permission grid generated from the code |

## Project layout

```
src/
  app/          pages and API routes: (public), (auth), dashboard, admin, super-admin, site, api
  components/   ui, layout, marketing, events, tickets, website builder sections and modules
  lib/          auth, authorization and permissions, payments, tickets, email, storage
prisma/         schema.prisma, migrations, seed
scripts/        docs builder, make-super-admin
e2e/            end-to-end browser checks
docs/           PDF guides, banner, screenshots
```

## Security

bcrypt (12 rounds), HMAC-signed tickets and webhooks, hashed API keys, CSP and HSTS headers,
prices worked out on the server, per-entity permission checks, sanitized HTML, rate limits and
an audit log on every admin action. See the security table in [`CHANGELOG.md`](./CHANGELOG.md).

## License

Proprietary. See [`LICENSE`](./LICENSE). All rights reserved.
