"use client"

import { WifiOff } from "lucide-react"
import { LogoMark } from "@/components/shared/Logo"
import { Mark, SYSTEM_CSS, TornTicket } from "../_system/TornTicket"
import { ctaGhost, ctaLemon } from "../_system/NotFoundView"

export default function OfflinePage() {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col overflow-x-clip px-5 sm:px-8">
      <style>{SYSTEM_CSS}</style>
      <header className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-lemon text-lemon-ink">
          <LogoMark className="size-5" />
        </span>
        <span className="font-display text-[18px] font-bold tracking-[-0.03em]">EventFlow</span>
      </header>
      <main className="mx-auto grid w-full max-w-[1240px] flex-1 items-center gap-16 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-lavender/40 bg-lavender/10 py-1.5 pr-3.5 pl-2.5 text-[13px] font-medium">
            <WifiOff className="size-4 text-brand" strokeWidth={2} aria-hidden />
            No connection
          </p>
          <h1 className="font-display mt-5 max-w-[14ch] text-[42px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[60px] xl:text-[68px]">
            You&apos;re <Mark>offline.</Mark>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
            No internet connection. Your tickets are cached and available. Go to My Tickets to view them.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {/* a full navigation on purpose: the service worker serves the cached tickets page */}
            <a href="/dashboard/tickets" className={ctaLemon}>
              View my tickets
            </a>
            <button type="button" className={ctaGhost} onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </div>

        <TornTicket
          big="Wi-Fi?"
          badge="Cached"
          bigClassName="text-[76px] sm:text-[104px]"
          stubLabel="Saved"
          code="TKT-0FFL1"
          rows={[
            ["Signal", "None"],
            ["Your tickets", "On this device"],
            ["Door scan", "Still works"],
            ["Next step", "Try again"],
          ]}
          className="mb-28 sm:mb-14 lg:mb-0"
        />
      </main>
    </div>
  )
}
