"use client"

import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"

interface DeviceFrameProps {
  device: "phone" | "tablet" | "desktop"
  children: React.ReactNode
  url?: string
  className?: string
}

/**
 * Admin chrome around a tenant-site preview: a quiet browser bar, or a
 * hairline device outline. The frame uses our tokens; what's inside is the
 * tenant's own design and is left alone.
 */
export function DeviceFrame({ device, children, url, className }: DeviceFrameProps) {
  if (device === "desktop") {
    return (
      <div className={cn("overflow-hidden rounded-lg border bg-background", className)}>
        {/* Browser bar */}
        <div className="flex items-center gap-2 border-b bg-raised px-3 py-2">
          <div className="flex gap-1.5" aria-hidden>
            <div className="size-2.5 rounded-full bg-input" />
            <div className="size-2.5 rounded-full bg-input" />
            <div className="size-2.5 rounded-full bg-input" />
          </div>
          <div className="mx-4 min-w-0 flex-1">
            <div className="mx-auto flex max-w-md items-center gap-2 rounded-[4px] border bg-background px-3 py-1 text-xs text-muted-foreground">
              <Lock className="size-3 shrink-0" aria-hidden />
              <span className="truncate font-mono text-[11px]">{url || "yourorg.eventflow.com"}</span>
            </div>
          </div>
        </div>
        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {children}
        </div>
      </div>
    )
  }

  if (device === "tablet") {
    return (
      <div className={cn("mx-auto", className)} style={{ maxWidth: 768 }}>
        <div className="rounded-[24px] border bg-raised p-2.5">
          <div className="flex justify-center pb-2" aria-hidden>
            <div className="size-1.5 rounded-full bg-input" />
          </div>
          {/* Screen */}
          <div className="overflow-y-auto rounded-[14px] border bg-background" style={{ maxHeight: "65vh" }}>
            {children}
          </div>
          <div className="h-2" aria-hidden />
        </div>
      </div>
    )
  }

  // Phone
  return (
    <div className={cn("mx-auto", className)} style={{ maxWidth: 375 }}>
      <div className="rounded-[32px] border bg-raised p-2">
        <div className="flex justify-center pt-0.5 pb-1.5" aria-hidden>
          <div className="h-1.5 w-16 rounded-full bg-input" />
        </div>
        {/* Screen */}
        <div className="overflow-y-auto rounded-[24px] border bg-background" style={{ maxHeight: "60vh" }}>
          {children}
        </div>
        <div className="flex justify-center pt-2 pb-0.5" aria-hidden>
          <div className="h-1 w-24 rounded-full bg-input" />
        </div>
      </div>
    </div>
  )
}

export default DeviceFrame
