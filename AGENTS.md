<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Rules for EventFlow

## Before Writing Code
1. Read the relevant registry file before creating sections/modules/templates
2. Check `prisma/schema.prisma` before using any Prisma model
3. Follow existing patterns — check a similar file before creating new ones

## Conventions
- API routes: always check auth + RBAC before any data operation
- Components: `"use client"` directive + default export for dynamic imports
- Module components: must accept `ModuleProps` from `module-renderer.tsx`
- Section components: must accept `SectionProps` pattern from `section-renderer.tsx`
- All feature module data uses the generic `FeatureModuleData` model (not per-module tables)
- Upsert on unique keys for idempotent seeding (slug for templates, moduleId for modules)

## File Naming
- Section components: `src/components/site-sections/{category}/{ComponentName}.tsx`
- Module components: `src/components/site-modules/{module-id}/{ComponentName}.tsx`
- Editor fields: `src/components/website/editor/fields/{FieldName}Editor.tsx`
- API routes: `src/app/api/admin/org/[orgId]/website/{resource}/route.ts`

## Testing Changes
- Always run `npx tsc --noEmit` after changes
- Always run `npx next build` to verify full compilation
- Check that API routes have auth (grep for `await auth()`)
- Verify module enablement checks in public-facing module APIs
