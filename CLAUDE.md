@AGENTS.md

# EventFlow — Project Guide

## Overview
EventFlow is a multi-tenant event management SaaS platform with an integrated website builder. Built with Next.js 16 (App Router, Turbopack), Prisma ORM, PostgreSQL (Supabase), NextAuth.js, and TypeScript.

## Tech Stack
- **Framework**: Next.js 16.2.2 (App Router, Server Components, Turbopack)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL via Supabase, Prisma ORM 6.19
- **Auth**: NextAuth.js (JWT strategy, Google + Microsoft + Credentials)
- **UI**: Tailwind CSS v4, shadcn/ui, Framer Motion v12, Lucide icons
- **State**: Zustand (3 stores: auth, UI, editor)
- **Drag & Drop**: @dnd-kit/core + sortable
- **Payments**: Razorpay
- **Package Manager**: pnpm

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (public)/           # Public pages (landing, events, pricing)
│   ├── (auth)/             # Auth pages (login, signup, forgot-password)
│   ├── admin/org/          # Org admin panel
│   │   └── website/        # Website builder admin
│   │       ├── editor/     # Visual editor
│   │       ├── templates/  # Template marketplace
│   │       ├── modules/    # Feature module marketplace
│   │       ├── media/      # Media library
│   │       └── content/    # Content overview
│   ├── dashboard/          # User dashboard
│   ├── super-admin/        # Super admin panel
│   ├── site/               # Dynamic website renderer (subdomain routing)
│   └── api/
│       ├── admin/org/[orgId]/website/  # Website builder APIs
│       ├── modules/                    # Public module APIs
│       └── site/[orgSlug]/             # Public site data APIs
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── shared/             # Reusable shared components
│   ├── layout/             # Layout components (AdminSidebar, etc.)
│   ├── site-sections/      # 19 section components (hero, about, events, etc.)
│   ├── site-modules/       # 12 module components (quiz, blog, gallery, etc.)
│   └── website/            # Website builder components
│       ├── editor/         # Editor panels + field editors (18 field types)
│       └── render/         # Live site components (navbar, footer, etc.)
├── lib/
│   ├── site-builder/       # Section/module/template registries + utilities
│   ├── auth.ts             # NextAuth config
│   ├── prisma.ts           # Prisma client singleton
│   ├── authorization.ts    # RBAC authorization
│   └── permissions.ts      # Permission constants + role mappings
├── stores/                 # Zustand stores (auth, UI, editor)
├── hooks/                  # Custom hooks (useRBAC, usePermissions, etc.)
└── types/                  # TypeScript type definitions
```

## Key Patterns

### Authentication & Authorization
- `auth()` from `@/lib/auth` for session
- `authorize(userId, PERMISSION, { organizationId })` for RBAC
- `useRBAC()` hook gives `currentOrganizationId` in client components
- Permissions: `PERMISSIONS.ORG_VIEW`, `PERMISSIONS.ORG_EDIT`, etc.

### API Routes
- Auth: `const session = await auth(); if (!session?.user?.id) return 401`
- Org resolution: `prisma.organization.findUnique({ where: { slug } })`
- Module enablement: check `SiteConfig.enabledFeatures` before serving
- Response format: `{ success: boolean, data?: any, message?: string }`

### Website Builder Architecture
- **Sections** (19): Visual building blocks defined in `sections.ts` registry
- **Modules** (12): Interactive features defined in `modules.ts` registry
- **Templates** (6): Pre-built configurations in `templates.ts`
- **SiteConfig**: Stores an org's website state (sections, styles, features)
- **Renderer**: `/site/*` routes serve published websites via subdomain rewrite

### Editor State (Zustand)
- `useEditorStore` — sections CRUD, styles, nav, footer, SEO, undo/redo (50 levels)
- Left panel: 6 tabs (Sections, Styles, Navigation, Settings, SEO, Pages)
- Right panel: live preview with device frames

### Dynamic Rendering
- Middleware detects `{slug}.eventflow.com` subdomains → rewrites to `/site/*`
- Layout fetches site config → applies CSS variables, Google Fonts, navbar/footer
- Catch-all `[...slug]` handles events, custom pages, module pages, 404

## Database
- **prisma db push** to sync schema
- **prisma db seed** seeds 6 templates + 12 modules (idempotent upsert)
- Key models: SiteTemplate, SiteConfig, SitePage, SiteMedia, FeatureModule, FeatureModuleData

## Commands
```bash
npx next dev          # Dev server
npx next build        # Production build
npx tsc --noEmit      # Type check
npx prisma db push    # Sync schema
npx prisma db seed    # Seed data
npx prisma generate   # Regenerate client
npx prisma studio     # Database GUI
```

## Important Notes
- All section types must match IDs in `SECTION_REGISTRY` (sections.ts)
- All module IDs must match `MODULE_REGISTRY` (modules.ts)
- Template `defaultSections` reference section types by exact string ID
- Feature modules store data in the generic `FeatureModuleData` model
- Public site APIs have NO auth (they serve the live website)
- Admin APIs ALL require auth + RBAC authorization
- The editor auto-saves every 60 seconds when dirty
- CSS custom properties from `styles.ts` power the site theming system
