"use client"

import Link from "next/link"
import type { SiteStyles } from "@/types/site-builder"

interface SiteNotFoundProps {
  siteName: string
  styles: SiteStyles
}

export function SiteNotFound({ siteName, styles }: SiteNotFoundProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4" style={{ backgroundColor: styles.backgroundColor, color: styles.textColor }}>
      <div className="text-center space-y-4 max-w-md">
        <p className="text-8xl font-bold" style={{ color: styles.primaryColor, opacity: 0.15 }}>404</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: styles.fontHeading }}>Page Not Found</h1>
        <p className="text-sm opacity-60">The page you&apos;re looking for doesn&apos;t exist on {siteName}.</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white" style={{ backgroundColor: styles.primaryColor, borderRadius: styles.borderRadius }}>
            Go Home
          </Link>
          <Link href="/events" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md border" style={{ borderColor: styles.primaryColor, color: styles.primaryColor, borderRadius: styles.borderRadius }}>
            Browse Events
          </Link>
        </div>
      </div>
    </div>
  )
}
