"use client"

import { cn } from "@/lib/utils"

interface DeviceFrameProps {
  device: "phone" | "tablet" | "desktop"
  children: React.ReactNode
  url?: string
  className?: string
}

export function DeviceFrame({ device, children, url, className }: DeviceFrameProps) {
  if (device === "desktop") {
    return (
      <div className={cn("rounded-xl border shadow-2xl bg-background overflow-hidden", className)}>
        {/* Browser title bar */}
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4">
            <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-1 text-xs text-muted-foreground max-w-md mx-auto">
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span className="truncate">{url || "yourorg.eventflow.com"}</span>
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
        <div className="rounded-[2rem] border-[8px] border-zinc-800 dark:border-zinc-700 bg-zinc-800 shadow-2xl overflow-hidden">
          {/* Camera */}
          <div className="flex justify-center py-2 bg-zinc-800">
            <div className="h-2 w-2 rounded-full bg-zinc-600" />
          </div>
          {/* Screen */}
          <div className="bg-background overflow-y-auto" style={{ maxHeight: "65vh" }}>
            {children}
          </div>
          {/* Bottom bezel */}
          <div className="h-3 bg-zinc-800" />
        </div>
      </div>
    )
  }

  // Phone
  return (
    <div className={cn("mx-auto", className)} style={{ maxWidth: 375 }}>
      <div className="rounded-[2.5rem] border-[6px] border-zinc-800 dark:border-zinc-700 bg-zinc-800 shadow-2xl overflow-hidden">
        {/* Notch / Dynamic Island */}
        <div className="flex justify-center pt-2 pb-1 bg-zinc-800">
          <div className="h-5 w-24 rounded-full bg-zinc-900" />
        </div>
        {/* Screen */}
        <div className="bg-background overflow-y-auto" style={{ maxHeight: "60vh" }}>
          {children}
        </div>
        {/* Home indicator */}
        <div className="flex justify-center py-2 bg-zinc-800">
          <div className="h-1 w-28 rounded-full bg-zinc-600" />
        </div>
      </div>
    </div>
  )
}

export default DeviceFrame
