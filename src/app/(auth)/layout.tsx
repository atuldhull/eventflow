import { Suspense } from "react"
import Link from "next/link"
import { LogoMark } from "@/components/shared/Logo"

/**
 * Sign-in, sign-up, password reset and verification share this frame: the
 * form on the white sheet, and on wide screens a navy field holding the
 * product's own artefact — an admission ticket — drawn in HTML.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="pt-safe pb-safe flex flex-col px-5 sm:px-10">
        <header className="flex h-16 items-center">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md text-foreground" aria-label="EventFlow home">
            <LogoMark />
            <span className="text-[15px] font-semibold">EventFlow</span>
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[400px] animate-fade-up">
            {/* The forms read ?callbackUrl / ?error from the URL (useSearchParams), which needs a
                Suspense boundary for these pages to build as static pages. */}
            <Suspense fallback={<div className="h-96" aria-busy="true" />}>{children}</Suspense>
          </div>
        </main>
        <footer className="flex h-14 items-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#141b2d] text-white lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden>
        <p className="max-w-[26ch] text-[28px] leading-[1.15] font-semibold tracking-[-0.02em]">
          Registration, tickets, the door and the certificate, in one place.
        </p>

        {/* the artefact: an admission ticket */}
        <div className="mx-auto w-full max-w-[420px]">
          <div className="flex overflow-hidden rounded-xl bg-white text-[#141b2d]">
            <div className="flex-1 p-6">
              <p className="text-xs text-[#565c6b]">Admit one</p>
              <p className="mt-1 text-xl leading-tight font-semibold">Annual Tech Symposium</p>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-[#565c6b]">Date</dt><dd className="font-medium">Sat, 14 Mar</dd></div>
                <div><dt className="text-xs text-[#565c6b]">Doors</dt><dd className="font-medium tabular-nums">09:30</dd></div>
                <div><dt className="text-xs text-[#565c6b]">Venue</dt><dd className="font-medium">Main Auditorium</dd></div>
                <div><dt className="text-xs text-[#565c6b]">Ticket</dt><dd className="font-medium">General</dd></div>
              </dl>
            </div>
            <div className="relative flex w-[132px] flex-col items-center justify-center gap-2 border-l-2 border-dashed border-[#d7dbe2] p-4">
              <span className="absolute -top-2.5 -left-[11px] size-5 rounded-full bg-[#141b2d]" />
              <span className="absolute -bottom-2.5 -left-[11px] size-5 rounded-full bg-[#141b2d]" />
              <QrGlyph />
              <span className="font-mono text-[11px] tracking-wide text-[#565c6b]">TKT-48A2</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-white/70">Used by universities, colleges and companies to run their events.</p>
      </aside>
    </div>
  )
}

/** A static QR-like glyph for the illustration (not a scannable code). */
function QrGlyph() {
  const cells = "1111111010111111100000101000011011101011101101110110100101111011101001100000101000001111111010101111111000000000110000000"
  return (
    <svg viewBox="0 0 11 11" className="size-20" shapeRendering="crispEdges">
      {cells.split("").slice(0, 121).map((c, i) =>
        c === "1" ? <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" fill="#141b2d" /> : null,
      )}
    </svg>
  )
}
