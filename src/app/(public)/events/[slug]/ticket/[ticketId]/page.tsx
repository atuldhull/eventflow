import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { TicketCard } from "@/components/tickets/TicketCard"
import { buttonVariants } from "@/components/ui/button"
import { ticketViewTokenMatches } from "@/lib/ticket-view-token"

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
    <main className="mx-auto w-full max-w-[420px] space-y-5 px-4 py-10">
      <div>
        <p className="text-[13px] text-muted-foreground">Your ticket</p>
        <h1 className="mt-0.5 text-[22px] leading-7 font-semibold">{ticket.event.title}</h1>
      </div>

      {valid ? (
        <div className="overflow-hidden rounded-xl border">
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
        <p role="status" className="rounded-lg bg-pill-negative px-4 py-3 text-sm text-pill-negative-foreground">
          This ticket is no longer valid ({ticket.status.toLowerCase()}). If you think this is a mistake, contact the organizer.
        </p>
      )}

      <div className="grid gap-2">
        {valid && (
          <a href={pdfHref} className={buttonVariants({ variant: "outline" })}>Download PDF</a>
        )}
        <Link href="/forgot-password" className={buttonVariants({ variant: "ghost" })}>
          Set a password to manage your tickets
        </Link>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Keep this link private: anyone who has it can show this ticket. Setting a password lets you sign in with this
        email and see all your tickets in your dashboard.
      </p>
    </main>
  )
}
