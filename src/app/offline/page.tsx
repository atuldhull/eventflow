"use client"

import { WifiOff } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { LogoMark } from "@/components/shared/Logo"
import { cn } from "@/lib/utils"

export default function OfflinePage() {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center gap-2">
        <LogoMark />
        <span className="text-[15px] font-semibold">EventFlow</span>
      </header>
      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[400px]">
          <WifiOff className="size-7 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <h1 className="mt-4 text-[28px] leading-tight font-semibold tracking-[-0.02em]">You&apos;re offline</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            No internet connection. Your tickets are cached and available — go to My Tickets to view them.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {/* a full navigation on purpose: the service worker serves the cached tickets page */}
            <a href="/dashboard/tickets" className={cn(buttonVariants({ size: "lg" }), "px-5")}>
              View my tickets
            </a>
            <Button variant="outline" size="lg" className="px-5" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
