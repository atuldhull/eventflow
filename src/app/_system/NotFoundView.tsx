import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Container } from '@/components/marketing/layout'
import { Mark, SYSTEM_CSS, TornTicket } from './TornTicket'

export const ctaLemon =
  'group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lemon px-6 text-[15px] font-semibold text-lemon-ink transition-[transform,box-shadow] duration-300 outline-none hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_var(--lemon)] focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0 active:scale-[0.98]'
export const ctaGhost =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-foreground/15 px-6 text-[15px] font-medium transition-colors duration-300 outline-none hover:border-lavender hover:bg-lavender/10 focus-visible:ring-3 focus-visible:ring-ring/50'

const MORE = [
  { href: '/dashboard/tickets', label: 'My tickets' },
  { href: '/for-organizers', label: 'For organizers' },
  { href: '/contact', label: 'Contact us' },
]

/**
 * The 404 screen, shared by the root not-found (no site chrome) and the public site's
 * not-found (inside its navbar and footer): a voided ticket with its stub torn off.
 */
export function NotFoundView({ message }: { message: string }) {
  return (
    <div className="w-full overflow-x-clip">
      <Container className="relative py-14 sm:py-20 lg:py-24">
        <style>{SYSTEM_CSS}</style>
        <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="text-[13px] font-semibold tracking-wide text-brand uppercase tabular-nums">
              Error 404 · Page not found
            </p>
            <h1 className="font-display mt-4 max-w-[15ch] text-[42px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[60px] xl:text-[68px]">
              This page doesn&apos;t have <Mark>a ticket.</Mark>
            </h1>
            <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
              {message}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/events" className={ctaLemon}>
                Browse events
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
              <Link href="/" className={ctaGhost}>
                Go home
              </Link>
            </div>
            <nav
              aria-label="More places to go"
              className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm"
            >
              {MORE.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="group inline-flex min-h-11 items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label}
                  <ArrowUpRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </Link>
              ))}
            </nav>
          </div>

          <TornTicket
            big="404"
            stubLabel="Stub"
            code="TKT-404"
            rows={[
              ['Event', 'This page'],
              ['Venue', 'Not found'],
              ['Date', 'Never'],
              ['Seat', 'None'],
            ]}
            className="mb-28 sm:mb-14 lg:mb-0"
          />
        </div>
      </Container>
    </div>
  )
}
