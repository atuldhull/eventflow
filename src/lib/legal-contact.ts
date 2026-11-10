/**
 * Who people write to about privacy, refunds and complaints. Set these on the server
 * (.env.local) to your real addresses before launch; the defaults are placeholders.
 * The grievance officer is required by India's DPDP Act and IT Rules: a named person who
 * answers complaints (within 30 days under the IT Rules).
 */
export const LEGAL_CONTACT = {
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@eventflow.com",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@eventflow.com",
  grievanceOfficer: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || "The Grievance Officer, EventFlow",
  companyName: process.env.NEXT_PUBLIC_LEGAL_ENTITY || "EventFlow",
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "India",
}
