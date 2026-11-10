import { Suspense } from "react"
import Link from "next/link"
import { LogoMark } from "@/components/shared/Logo"
import { Marquee } from "@/components/marketing/fx"
import { BrandPanel } from "./_components/BrandPanel"

/** Page-local motion for these screens: the heading's lemon highlighter draws in, and the form rises. */
const AUTH_CSS = `
@keyframes auth-mark-in { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes auth-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.auth-mark { animation: auth-mark-in .7s cubic-bezier(.22,1,.36,1) .25s both; }
.auth-rise { animation: auth-rise .7s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .auth-mark, .auth-rise { animation: none; } }
`

const STRIP = ["Find it", "Register", "Walk right in", "Tickets on your phone", "QR check-in", "Certificates"]

/**
 * Sign-in, sign-up, password reset and verification share this frame: the form on the
 * left, roomy and calm; on wide screens a charcoal brand panel with the tilting sample
 * ticket and a marquee band. On phones the panel shrinks to a thin lemon strip on top.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <style>{AUTH_CSS}</style>

      <div className="flex min-w-0 flex-col">
        {/* phones and tablets: the brand panel, folded into one moving strip */}
        <div aria-hidden className="pt-safe bg-lemon text-lemon-ink lg:hidden">
          <Marquee speed={30} className="py-2">
            {STRIP.map((w) => (
              <span key={w} className="font-display flex items-center gap-4 px-2 text-[15px] font-extrabold tracking-[-0.02em]">
                {w}
                <span className="size-1.5 rounded-full bg-charcoal" />
              </span>
            ))}
          </Marquee>
        </div>

        <div className="pb-safe flex flex-1 flex-col px-5 sm:px-10 lg:pt-safe xl:px-16">
          <header className="flex h-16 items-center lg:h-20">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="EventFlow home"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-lemon text-lemon-ink">
                <LogoMark className="size-5" />
              </span>
              <span className="font-display text-[18px] font-bold tracking-[-0.03em]">EventFlow</span>
            </Link>
          </header>
          <main className="flex flex-1 items-start justify-center py-6 sm:items-center sm:py-10">
            <div className="auth-rise w-full max-w-[420px]">
              {/* The forms read ?callbackUrl / ?error from the URL (useSearchParams), which needs a
                  Suspense boundary for these pages to build as static pages. */}
              <Suspense fallback={<div className="h-96" aria-busy="true" />}>{children}</Suspense>
            </div>
          </main>
          <footer className="flex h-14 items-center gap-5 text-[13px] text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </footer>
        </div>
      </div>

      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:p-3" aria-hidden>
        <BrandPanel />
      </aside>
    </div>
  )
}
