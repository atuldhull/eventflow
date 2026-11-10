import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { LogoMark } from "@/components/shared/Logo"

const GROUPS = [
  { title: "Platform", links: [{ label: "Browse events", href: "/events" }, { label: "For organizers", href: "/for-organizers" }, { label: "Pricing", href: "/pricing" }] },
  // "/help" never existed (it returned 404); Developers is the real resources page.
  { title: "Resources", links: [{ label: "Developers", href: "/developers" }, { label: "Contact", href: "/contact" }] },
  { title: "Company", links: [{ label: "About", href: "/about" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Refunds", href: "/refunds" }] },
]

/**
 * Always charcoal, whatever the theme: the link groups, then the name at full
 * width in a slowly moving lavender-to-lemon gradient. The wordmark is shown
 * whole (it used to be cropped at the baseline, which read as a bug).
 */
export function Footer() {
  return (
    <footer className="pb-safe relative overflow-hidden bg-[#111111] text-white">
      {/* a lavender glow rising from the bottom edge */}
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[80%] -translate-x-1/2 rounded-full bg-lavender/25 blur-[120px]" />

      <div className="relative mx-auto max-w-[1240px] px-5 pt-16 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="EventFlow home">
              <span className="flex size-8 items-center justify-center rounded-[9px] bg-lemon text-lemon-ink">
                <LogoMark className="size-5" />
              </span>
              <span className="font-display text-[17px] font-bold tracking-[-0.02em]">EventFlow</span>
            </Link>
            <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-white/65">
              Registration, tickets, payments, check-in at the door and certificates for universities, colleges and companies.
            </p>
          </div>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h2 className="text-sm font-semibold text-lemon">{g.title}</h2>
              <ul className="mt-4 space-y-3">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="group inline-flex items-center gap-1 text-sm text-white/70 transition-colors hover:text-white">
                      {l.label}
                      <ArrowUpRight
                        className="size-3.5 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p
          aria-hidden
          className="fx-gradient-text font-display mt-16 pb-6 text-center text-[clamp(3.25rem,15.5vw,14.5rem)] leading-[0.95] font-extrabold tracking-[-0.055em] select-none"
        >
          EventFlow
        </p>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-5 text-xs text-white/55 sm:flex-row sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} EventFlow</p>
          <p>Made in India</p>
        </div>
      </div>
    </footer>
  )
}
