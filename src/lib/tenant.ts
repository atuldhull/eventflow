import prisma from "@/lib/prisma"

export interface TenantContext {
  type: "enterprise" | "organization"
  id: string
  slug: string
  name: string
  logo: string | null
  primaryColor: string
  secondaryColor: string
  customDomain: string | null
  subdomain: string | null
  isWhiteLabel: boolean
}

export interface TenantBranding {
  name: string
  logo: string | null
  banner: string | null
  primaryColor: string
  secondaryColor: string
  faviconUrl: string | null
  hideEventFlowBranding: boolean
  footerText: string | null
  socialLinks: Record<string, string> | null
  description: string | null
}

// In-memory cache with TTL
const tenantCache = new Map<string, { tenant: TenantContext | null; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function resolveTenant(hostname: string): Promise<TenantContext | null> {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"

  // Main platform domain
  if (hostname === rootDomain || hostname === `www.${rootDomain}` || hostname.startsWith("localhost")) {
    return null
  }

  // Check cache
  const cached = tenantCache.get(hostname)
  if (cached && cached.expires > Date.now()) {
    return cached.tenant
  }

  let tenant: TenantContext | null = null

  // Check if it's a subdomain of the root domain
  if (hostname.endsWith(`.${rootDomain.replace(/:\d+$/, "")}`)) {
    const subdomain = hostname.split(".")[0]

    // Try enterprise
    const enterprise = await prisma.enterprise.findFirst({
      where: { OR: [{ subdomain }, { slug: subdomain }], isActive: true, deletedAt: null },
      select: { id: true, slug: true, name: true, logo: true, primaryColor: true, secondaryColor: true, customDomain: true, subdomain: true },
    })

    if (enterprise) {
      tenant = {
        type: "enterprise",
        id: enterprise.id,
        slug: enterprise.slug,
        name: enterprise.name,
        logo: enterprise.logo,
        primaryColor: enterprise.primaryColor || "#09090b",
        secondaryColor: enterprise.secondaryColor || "#ffffff",
        customDomain: enterprise.customDomain,
        subdomain: enterprise.subdomain || enterprise.slug,
        isWhiteLabel: false,
      }
    } else {
      // Try organization
      const org = await prisma.organization.findFirst({
        where: { slug: subdomain, isActive: true, deletedAt: null },
        select: { id: true, slug: true, name: true, logo: true, primaryColor: true, secondaryColor: true },
      })

      if (org) {
        tenant = {
          type: "organization",
          id: org.id,
          slug: org.slug,
          name: org.name,
          logo: org.logo,
          primaryColor: org.primaryColor || "#09090b",
          secondaryColor: org.secondaryColor || "#ffffff",
          customDomain: null,
          subdomain: org.slug,
          isWhiteLabel: false,
        }
      }
    }
  } else {
    // Custom domain
    const enterprise = await prisma.enterprise.findFirst({
      where: { customDomain: hostname, isActive: true, deletedAt: null },
      select: { id: true, slug: true, name: true, logo: true, primaryColor: true, secondaryColor: true, customDomain: true, subdomain: true },
    })

    if (enterprise) {
      tenant = {
        type: "enterprise",
        id: enterprise.id,
        slug: enterprise.slug,
        name: enterprise.name,
        logo: enterprise.logo,
        primaryColor: enterprise.primaryColor || "#09090b",
        secondaryColor: enterprise.secondaryColor || "#ffffff",
        customDomain: enterprise.customDomain,
        subdomain: enterprise.subdomain,
        isWhiteLabel: true,
      }
    }
  }

  tenantCache.set(hostname, { tenant, expires: Date.now() + CACHE_TTL })
  return tenant
}

export async function getTenantBranding(tenantId: string, tenantType: "enterprise" | "organization"): Promise<TenantBranding> {
  if (tenantType === "enterprise") {
    const ent = await prisma.enterprise.findUnique({
      where: { id: tenantId },
      select: { name: true, logo: true, banner: true, primaryColor: true, secondaryColor: true, description: true, socialLinks: true },
    })
    return {
      name: ent?.name || "EventFlow",
      logo: ent?.logo || null,
      banner: ent?.banner || null,
      primaryColor: ent?.primaryColor || "#09090b",
      secondaryColor: ent?.secondaryColor || "#ffffff",
      faviconUrl: null,
      hideEventFlowBranding: false,
      footerText: null,
      socialLinks: ent?.socialLinks as Record<string, string> | null,
      description: ent?.description || null,
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { name: true, logo: true, banner: true, primaryColor: true, secondaryColor: true, description: true, socialLinks: true },
  })
  return {
    name: org?.name || "EventFlow",
    logo: org?.logo || null,
    banner: org?.banner || null,
    primaryColor: org?.primaryColor || "#09090b",
    secondaryColor: org?.secondaryColor || "#ffffff",
    faviconUrl: null,
    hideEventFlowBranding: false,
    footerText: null,
    socialLinks: org?.socialLinks as Record<string, string> | null,
    description: org?.description || null,
  }
}

export function clearTenantCache(hostname?: string) {
  if (hostname) tenantCache.delete(hostname)
  else tenantCache.clear()
}
