"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { reportClientError } from "@/lib/report-client-error"
import { Mark, SYSTEM_CSS } from "./_system/TornTicket"
import { ctaGhost, ctaLemon } from "./_system/NotFoundView"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
    reportClientError(error)
  }, [error])

  return (
    <div className="flex min-h-[70dvh] flex-1 items-center justify-center px-5 py-16">
      <style>{SYSTEM_CSS}</style>
      <div className="w-full max-w-[560px]">
        <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">Something broke</p>
        <h1 className="font-display mt-4 text-[38px] leading-[1.04] font-extrabold tracking-[-0.045em] sm:text-[52px]">
          Something went <Mark>wrong.</Mark>
        </h1>
        <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
          We&apos;re sorry, an unexpected error occurred. Our team has been notified.
        </p>
        {process.env.NODE_ENV === "development" && (
          <details className="mt-6 rounded-2xl border bg-muted/50 p-4 text-left text-xs">
            <summary className="cursor-pointer font-medium">Error Details</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-destructive">{error.message}</pre>
            {error.digest && <p className="mt-1 text-muted-foreground">Digest: {error.digest}</p>}
          </details>
        )}
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={reset} className={ctaLemon}>
            <RefreshCw className="size-4 transition-transform duration-500 group-hover:rotate-180" aria-hidden /> Try again
          </button>
          <Link href="/" className={ctaGhost}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
