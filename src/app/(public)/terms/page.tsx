import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument, type LegalSection } from "@/components/marketing/LegalDocument"
import { LEGAL_CONTACT } from "@/lib/legal-contact"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "EventFlow terms of service — rules and guidelines for using our platform.",
}

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of terms",
    body: <p>By accessing or using EventFlow, you agree to be bound by these Terms of Service.</p>,
  },
  {
    id: "service",
    title: "Description of service",
    body: <p>EventFlow provides an event management platform that allows users to create, manage, discover, and register for events.</p>,
  },
  {
    id: "accounts",
    title: "User accounts",
    body: <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>,
  },
  {
    id: "event-creation",
    title: "Event creation",
    body: <p>Event organizers are responsible for the accuracy of event information and compliance with applicable laws.</p>,
  },
  {
    id: "payments",
    title: "Payments",
    body: (
      <>
        <p>
          Paid tickets are sold by the event&apos;s organizer and paid through Razorpay; EventFlow never sees your card or UPI
          details. The organizer decides whether a ticket can be refunded. If the organizer cancels an event, paid tickets
          are refunded. See the <Link href="/refunds">refund and cancellation policy</Link>.
        </p>
        <p>
          Organizers are responsible for honouring refunds they promise and for the personal data they collect through
          their registration forms, which they may use only to run their event.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: <p>All content and materials on EventFlow are owned by or licensed to us. You may not reproduce or distribute our content without permission.</p>,
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: <p>EventFlow is provided &quot;as is.&quot; We are not liable for any damages arising from the use of our platform.</p>,
  },
  {
    id: "termination",
    title: "Termination",
    body: <p>We reserve the right to suspend or terminate accounts that violate these terms.</p>,
  },
  {
    id: "governing-law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of {LEGAL_CONTACT.jurisdiction}. We&apos;ll try to resolve any dispute with you directly first.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        For questions about these terms, contact us at <a href="mailto:legal@eventflow.com">legal@eventflow.com</a>.
      </p>
    ),
  },
]

export default function TermsPage() {
  return <LegalDocument title="Terms of service" updated="November 2026" sections={sections} />
}
