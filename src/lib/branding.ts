import type { TenantBranding } from "@/lib/tenant"

export function getBrandingCSS(branding: TenantBranding): string {
  return `:root {
  --brand-primary: ${branding.primaryColor};
  --brand-secondary: ${branding.secondaryColor};
}`
}

export function getBrandingMetadata(branding: TenantBranding, pageTitle?: string) {
  const siteName = branding.hideEventFlowBranding ? branding.name : `${branding.name} — Powered by EventFlow`

  return {
    title: pageTitle ? `${pageTitle} | ${branding.name}` : branding.name,
    description: branding.description || `Events by ${branding.name}`,
    icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
    openGraph: {
      siteName,
      images: branding.banner ? [branding.banner] : branding.logo ? [branding.logo] : [],
    },
  }
}
