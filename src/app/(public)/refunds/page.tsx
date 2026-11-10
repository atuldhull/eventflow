import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument, type LegalSection } from "@/components/marketing/LegalDocument"
import { LEGAL_CONTACT } from "@/lib/legal-contact"

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description: "When ticket payments on EventFlow are refunded, how long it takes, and who to contact.",
}

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>

const sections: LegalSection[] = [
  {
    id: "who-decides",
    title: "Who sets the refund rules",
    body: (
      <p>
        Each event is run by its organizer (a college, club or other group), who sells the tickets through EventFlow and
        decides whether tickets can be refunded. If an event page states its own refund terms, those apply. Otherwise the
        rules below apply.
      </p>
    ),
  },
  {
    id: "event-cancelled",
    title: "If the organizer cancels the event",
    body: (
      <p>
        You get a full refund of what you paid. When an organizer cancels an event on EventFlow, paid tickets are refunded
        automatically to the original payment method, and you get an email for the cancellation and another for the refund.
        If the organizer chose to pay people back another way (for example by bank transfer), they will contact you.
      </p>
    ),
  },
  {
    id: "you-cancel",
    title: "If you can't attend",
    body: (
      <p>
        Ask the organizer for a refund; their contact is on the event page. If they agree, they refund you from EventFlow
        (in full or in part) and you get an email confirming it. A full refund cancels your ticket. If the organizer allows
        it, you can instead transfer your ticket to a friend from <Link href="/dashboard/tickets">My tickets</Link>.
      </p>
    ),
  },
  {
    id: "timing",
    title: "How long a refund takes",
    body: (
      <p>
        Refunds go back to the card, UPI account, wallet or bank account you paid with, through our payment partner Razorpay.
        Once a refund is issued, banks usually take 5–7 working days to show it.
      </p>
    ),
  },
  {
    id: "failed-payments",
    title: "Failed or interrupted payments",
    body: (
      <p>
        If money left your account but your ticket wasn&apos;t confirmed, you aren&apos;t charged: either the ticket is confirmed
        automatically when the payment reaches us, or the bank reverses the payment, usually within 5–7 working days. A seat
        held during checkout is released after 15 minutes if the payment doesn&apos;t complete.
      </p>
    ),
  },
  {
    id: "fees",
    title: "Fees",
    body: <p>EventFlow doesn&apos;t add a booking or convenience fee: you pay the price shown at checkout, and a full refund returns all of it.</p>,
  },
  {
    id: "help",
    title: "Need help?",
    body: (
      <p>
        Contact the event&apos;s organizer first. If they don&apos;t respond within 7 days, or something went wrong with a payment,
        write to {mail(LEGAL_CONTACT.supportEmail)} with your payment number (it&apos;s on your receipt and under{" "}
        <Link href="/dashboard/payments">My payments</Link>).
      </p>
    ),
  },
]

export default function RefundsPage() {
  return <LegalDocument title="Refund and cancellation policy" updated="November 2026" sections={sections} />
}
