import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { TicketCard } from "@/components/tickets/TicketCard"
import { buttonVariants } from "@/components/ui/button"
import { ticketViewTokenMatches } from "@/lib/ticket-view-token"
import { cn } from "@/lib/utils"

// The token is in the URL: never cache, never index, never send it on as a referrer.
export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const NO_LONGER_VALID = ["CANCELLED", "TRANSFERRED", "EXPIRED"]

/**
 * A guest's view-only ticket, opened from the link emailed (and shown) after registering
 * without an account. No session: the ticket's stored token hash is the key.
 */
export default async function GuestTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; ticketId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug, ticketId } = await params
  const { k } = await searchParams
  const token = typeof k === "string" ? k : null

  const ticket = ticketId.length <= 64
    ? await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true, ticketNumber: true, qrCode: true, status: true, metadata: true,
          event: {
            select: {
              slug: true, title: true, startDate: true, endDate: true, venue: true, venueCity: true,
              isOnline: true, type: true, coverImage: true, organization: { select: { name: true } },
            },
          },
          ticketType: { select: { name: true, price: true, currency: true } },
          registration: { select: { registrationNumber: true, status: true } },
          checkIns: { select: { checkedInAt: true }, take: 1 },
        },
      })
    : null

  if (!ticket || ticket.event.slug !== slug || !ticketViewTokenMatches(ticket.metadata, token)) notFound()

  const valid = !NO_LONGER_VALID.includes(ticket.status)
  const pdfHref = `/api/events/${encodeURIComponent(slug)}/tickets/${encodeURIComponent(ticket.id)}/pdf?k=${encodeURIComponent(token!)}`

  return (
    <main className="relative isolate overflow-hidden">
      <div aria-hidden className="fx-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px]" />
      <div aria-hidden className="pointer-events-none absolute top-[-140px] left-1/2 -z-10 size-[420px] -translate-x-1/2 rounded-full bg-lavender/25 blur-[110px]" />
      <div className="mx-auto w-full max-w-[440px] space-y-6 px-4 pt-10 pb-16 sm:pt-14">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
            Your ticket
          </p>
          <h1 className="font-display mt-3 text-[30px] leading-[1.04] font-extrabold tracking-[-0.04em] text-balance sm:text-[36px]">{ticket.event.title}</h1>
        </div>

        {valid ? (
          <div className="drop-shadow-[0_24px_36px_rgb(0_0_0/0.25)]">
            <TicketCard
              variant="full"
              ticket={{
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                qrCode: ticket.qrCode,
                status: ticket.status,
                event: {
                  ...ticket.event,
                  startDate: ticket.event.startDate.toISOString(),
                  endDate: ticket.event.endDate.toISOString(),
                },
                ticketType: { ...ticket.ticketType, price: Number(ticket.ticketType.price) },
                registration: ticket.registration,
                checkIns: ticket.checkIns,
              }}
            />
          </div>
        ) : (
          <div role="status" className="rounded-3xl border border-destructive/40 bg-pill-negative px-5 py-5 text-pill-negative-foreground">
            <p className="font-display text-[22px] leading-tight font-bold tracking-[-0.02em]">No longer valid</p>
            <p className="mt-1.5 text-sm">
              This ticket is no longer valid ({ticket.status.toLowerCase()}). If you think this is a mistake, contact the organizer.
            </p>
          </div>
        )}

        <div className="grid gap-2">
          {valid && (
            <a
              href={pdfHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lemon px-6 text-[15px] font-semibold text-lemon-ink transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-10px_var(--lemon)]"
            >
              Download PDF
            </a>
          )}
          <Link href="/forgot-password" className={cn(buttonVariants({ variant: "ghost" }), "h-11")}>
            Set a password to manage your tickets
          </Link>
        </div>
        <p className="rounded-2xl border border-dashed px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Keep this link private: anyone who has it can show this ticket. Setting a password lets you sign in with this
          email and see all your tickets in your dashboard.
        </p>
      </div>
    </main>
  )
}
