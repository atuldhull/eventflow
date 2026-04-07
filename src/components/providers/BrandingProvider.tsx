"use client"

import { createContext, useContext, useEffect } from "react"
import type { TenantBranding } from "@/lib/tenant"

interface BrandingContextValue {
  branding: TenantBranding | null
  isWhiteLabel: boolean
  isTenantContext: boolean
  tenantName: string
  platformName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  isWhiteLabel: false,
  isTenantContext: false,
  tenantName: "EventFlow",
  platformName: "EventFlow",
  logoUrl: null,
  primaryColor: "#09090b",
  secondaryColor: "#ffffff",
})

export function BrandingProvider({
  branding,
  children,
}: {
  branding: TenantBranding | null
  children: React.ReactNode
}) {
  const isWhiteLabel = branding?.hideEventFlowBranding || false
  const isTenantContext = !!branding
  const tenantName = branding?.name || "EventFlow"
  const platformName = isWhiteLabel ? tenantName : "EventFlow"

  useEffect(() => {
    if (!branding) return

    const root = document.documentElement
    root.style.setProperty("--brand-primary", branding.primaryColor)
    root.style.setProperty("--brand-secondary", branding.secondaryColor)

    // Update favicon if tenant has one
    if (branding.faviconUrl) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement("link")
      link.rel = "icon"
      link.href = branding.faviconUrl
      document.head.appendChild(link)
    }

    return () => {
      root.style.removeProperty("--brand-primary")
      root.style.removeProperty("--brand-secondary")
    }
  }, [branding])

  return (
    <BrandingContext.Provider
      value={{
        branding,
        isWhiteLabel,
        isTenantContext,
        tenantName,
        platformName,
        logoUrl: branding?.logo || null,
        primaryColor: branding?.primaryColor || "#09090b",
        secondaryColor: branding?.secondaryColor || "#ffffff",
      }}
    >
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
