import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument, type LegalSection } from "@/components/marketing/LegalDocument"
import { LEGAL_CONTACT } from "@/lib/legal-contact"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "EventFlow privacy policy — what we collect, why, who sees it, how long we keep it, and your rights.",
}

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <p>
        EventFlow is an event registration and ticketing platform run by {LEGAL_CONTACT.companyName}. Colleges, clubs and
        other organizers use it to publish events; attendees use it to register, pay and get tickets. This policy explains
        how we handle personal data under India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act).
      </p>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    body: (
      <>
        <p>
          <strong>From you:</strong> your name, email, and, if you add them, phone number, college or company, and profile
          details. Your answers to an event&apos;s registration form (the organizer chooses those questions). If you sign in
          with Google or Microsoft, we receive your name, email and profile picture from them.
        </p>
        <p>
          <strong>From using EventFlow:</strong> your registrations, tickets, check-ins, certificates, payments (amount, status
          and the payment gateway&apos;s reference, never your card or UPI details, which go straight to Razorpay), and
          security logs (sign-in times and IP addresses).
        </p>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "Why we use it",
    body: (
      <p>
        To run the service you asked for: register you, take payment, issue and check tickets and certificates, send emails
        about your events (confirmations, receipts, reminders, changes), keep accounts secure, prevent fraud, meet our legal
        obligations (such as tax records), and improve the platform. We use your data on the basis of your consent, given
        when you sign up or register, and for these legitimate uses permitted by the DPDP Act. We don&apos;t sell your data
        or use it for advertising.
      </p>
    ),
  },
  {
    id: "data-sharing",
    title: "Who sees it",
    body: (
      <>
        <p>
          <strong>Organizers</strong> of the events you register for see your name, email, the answers you gave and your
          ticket and payment status, so they can run their event. They must use it only for that event.
        </p>
        <p>
          <strong>Service providers</strong> that process data for us: our hosting provider (servers and database),
          Razorpay (payments), our email provider (for example Resend) and our error-monitoring service. They may only use it
          to provide their service to us.
        </p>
        <p>We may also disclose data when the law requires it, for example to comply with a court order.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep your account data while your account exists. When you delete your account, your profile is erased
        straight away and your past registrations are kept only without your name and form answers. Payment and invoice
        records are kept for as long as Indian tax law requires (currently up to 8 years). Security and audit logs are kept
        only as long as needed to protect the service and meet legal duties. Backups are overwritten within 14 days.
      </p>
    ),
  },
  {
    id: "data-security",
    title: "Data security",
    body: (
      <p>
        Data travels over encrypted connections (HTTPS). Passwords are stored only as one-way hashes, tickets are signed so
        they can&apos;t be forged, and staff access is limited by role. No system is perfectly secure; if a breach affects
        your data, we will tell you and the Data Protection Board as the DPDP Act requires.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use only essential cookies: to keep you signed in, protect forms, and remember preferences such as the theme. We
        don&apos;t use advertising or cross-site tracking cookies.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        EventFlow is meant for people aged 18 and over. If you are under 18, a parent or guardian must agree before you
        create an account or register. If we learn that we hold a child&apos;s data without that consent, we delete it.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li>see a summary of the data we hold about you and who we share it with;</li>
          <li>correct or update it (most of it in your profile);</li>
          <li>have it erased, and withdraw your consent at any time (this ends your account);</li>
          <li>complain to us, and then to the Data Protection Board of India;</li>
          <li>name someone to exercise these rights if you die or become unable to.</li>
        </ul>
        <p>
          You can do two of these yourself, at any time, under <Link href="/dashboard/settings">Dashboard → Settings → Your data</Link>:
          download a copy of everything we keep about you as a file, or delete your account. Deleting erases your profile and
          cancels your upcoming registrations; payment records are kept without your name, because tax law requires it.
          For anything else, write to {mail(LEGAL_CONTACT.privacyEmail)}.
        </p>
      </>
    ),
  },
  {
    id: "grievances",
    title: "Grievance officer",
    body: (
      <p>
        If you have a complaint about how your data is handled, contact {LEGAL_CONTACT.grievanceOfficer} at{" "}
        {mail(LEGAL_CONTACT.privacyEmail)}. We aim to resolve every complaint within 30 days.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>We post every change here with a new date, and email you about changes that affect how your data is used.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>For privacy-related questions, email us at {mail(LEGAL_CONTACT.privacyEmail)}.</p>,
  },
]

export default function PrivacyPage() {
  return <LegalDocument title="Privacy policy" updated="November 2026" sections={sections} />
}
