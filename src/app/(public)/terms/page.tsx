import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service | EventFlow",
  description: "EventFlow terms of service — rules and guidelines for using our platform.",
}

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: April 2026</p>
      <div className="prose prose-zinc dark:prose-invert mt-8">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using EventFlow, you agree to be bound by these Terms of Service.</p>
        <h2>2. Description of Service</h2>
        <p>EventFlow provides an event management platform that allows users to create, manage, discover, and register for events.</p>
        <h2>3. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
        <h2>4. Event Creation</h2>
        <p>Event organizers are responsible for the accuracy of event information and compliance with applicable laws.</p>
        <h2>5. Payments</h2>
        <p>Payments for paid events are processed through third-party payment gateways. EventFlow is not responsible for payment disputes.</p>
        <h2>6. Intellectual Property</h2>
        <p>All content and materials on EventFlow are owned by or licensed to us. You may not reproduce or distribute our content without permission.</p>
        <h2>7. Limitation of Liability</h2>
        <p>EventFlow is provided &quot;as is.&quot; We are not liable for any damages arising from the use of our platform.</p>
        <h2>8. Termination</h2>
        <p>We reserve the right to suspend or terminate accounts that violate these terms.</p>
        <h2>9. Contact</h2>
        <p>For questions about these terms, contact us at legal@eventflow.com.</p>
      </div>
    </div>
  )
}
