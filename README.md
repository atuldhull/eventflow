# EventFlow

**EventFlow** is a production-grade, multi-tenant **Event Management SaaS** with an integrated drag-and-drop website builder. It targets universities, colleges, companies, and organizations of every size — from a single community meetup to an enterprise running events across many sub-organizations.

> Built with Next.js 16 (App Router + Turbopack), TypeScript (strict), Prisma 6, PostgreSQL, and NextAuth v5.

---

## Features

- **Multi-tenant hierarchy** — Enterprise → Organization → Event, with data scoped at every level
- **9-role RBAC** — 70+ granular permissions resolved per-entity (enterprise / org / event)
- **Event management** — 6-step creation wizard, multi ticket types, add-ons, coupons, recurring & private/invite-only events
- **Registration & ticketing** — custom forms (12 field types), guest checkout, QR tickets with HMAC signing, transfers
- **Check-in** — QR scanner (html5-qrcode) + manual search, real-time stats, offline ticket access (PWA)
- **Payments** — Razorpay integration, server-side price calculation, GST, refunds, invoices
- **Website builder** — 19 sections, 12 feature modules, 6 templates, live subdomain rendering
- **Certificates** — template designer + public verification
- **Comms** — bulk email (Resend), announcements, in-app notifications, webhooks (HMAC-SHA256)
- **Public API v1** — API-key (Bearer) auth with scopes and per-key rate limiting
- **Operations** — audit logging on all admin actions, super-admin platform console, maintenance mode

See [`CHANGELOG.md`](./CHANGELOG.md) for the full feature/route reference, and the [`docs/`](./docs) folder for the user guide and admin reference PDFs.

---

## Tech Stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16.2 (App Router, Server Components, Turbopack) |
| Language | TypeScript (strict) |
| Database | PostgreSQL (Supabase) via Prisma 6 ORM |
| Auth | NextAuth v5 (JWT) — Credentials + Google + Microsoft |
| UI | Tailwind CSS v4, shadcn/ui, Framer Motion v12, Lucide |
| State | Zustand (auth / UI / editor) |
| Payments | Razorpay | 
| Email | Resend + Nodemailer |
| Validation | Zod v4 |
| Package manager | pnpm |

---

## Getting Started

### Prerequisites
- **Node.js** ≥ 20 (developed on Node 22)
- **pnpm** (`npm i -g pnpm`)
- A **PostgreSQL** database (e.g. Supabase) and optionally **Redis** for rate limiting

### 1. Install
```bash
pnpm install
```

### 2. Configure environment
Copy the example and fill in real values:
```bash
cp .env.example .env
```
At minimum set `DATABASE_URL`, `NEXTAUTH_SECRET` (`openssl rand -hex 32`), and `TICKET_SECRET` (32+ chars). OAuth, Razorpay, and Resend keys are optional for local dev. **Never commit `.env` / `.env.local`** — they are gitignored.

### 3. Set up the database
```bash
pnpm exec prisma generate    # generate the client
pnpm exec prisma db push     # sync schema to the database
pnpm exec prisma db seed     # seed templates, modules, and an initial admin
```

### 4. Run the dev server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production server |
| `pnpm lint` | Run ESLint |
| `pnpm exec tsc --noEmit` | Type-check |
| `pnpm exec prisma db push` | Sync Prisma schema |
| `pnpm exec prisma db seed` | Seed the database |
| `pnpm exec prisma studio` | Open the Prisma DB GUI |

---

## Project Structure

```
src/
├── app/                # App Router: (public), (auth), admin/org, dashboard,
│                       # super-admin, site (subdomain renderer), api/
├── components/         # ui/, shared/, layout/, site-sections/, site-modules/, website/
├── lib/                # auth, prisma, authorization (RBAC), permissions, security, site-builder/
├── stores/             # Zustand stores (auth, UI, editor)
├── hooks/              # useRBAC, usePermissions, …
├── types/              # shared TypeScript types
└── middleware.ts       # subdomain routing + maintenance mode
prisma/                 # schema.prisma (44 models) + seed.ts
scripts/                # docs generation
docs/                   # user-guide.pdf, admin-reference.pdf
```

A deeper architecture guide lives in [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md).

---

## Deployment

A `Dockerfile` and `docker-compose.yml` are included:
```bash
docker compose up --build
```
For platforms like Vercel, set the same environment variables in the project settings. Before a production deploy, prefer migration-based schema management (`prisma migrate`) over `db push`.

---

## Security

EventFlow ships with bcrypt password hashing (12 rounds), HMAC-signed tickets/webhooks, SHA-256 API-key storage, CSP/HSTS headers, server-side price calculation, per-entity RBAC, DOMPurify HTML sanitization, and audit logging. See the Security Controls table in [`CHANGELOG.md`](./CHANGELOG.md).

---

## License

Proprietary — see [`LICENSE`](./LICENSE). All rights reserved.
