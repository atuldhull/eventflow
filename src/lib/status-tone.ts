import type { Tone } from "@/components/ui/pill"

/**
 * One mapping from every status string in the product (event, registration,
 * payment, ticket, certificate, subscription, member) to a pill tone and a
 * sentence-case label. Presentation only: no status values change.
 */
const TONES: Record<string, Tone> = {
  // positive
  active: "positive", published: "positive", confirmed: "positive", approved: "positive", paid: "positive",
  completed_payment: "positive", success: "positive", succeeded: "positive", issued: "positive", generated: "positive",
  sent: "positive", delivered: "positive", verified: "positive", registration_open: "positive", checked_in: "positive",
  live: "positive", ongoing: "positive", trialing: "info", valid: "positive", used: "neutral",
  // warning
  pending: "warning", pending_approval: "warning", processing: "warning", review: "warning", awaiting: "warning",
  waitlisted: "warning", postponed: "warning", partially_refunded: "warning", past_due: "warning", invited: "warning",
  // negative
  cancelled: "negative", canceled: "negative", rejected: "negative", failed: "negative", expired: "negative",
  banned: "negative", no_show: "negative", unpaid: "negative", suspended: "negative",
  // info
  registration_closed: "info", refunded: "info", transferred: "info", scheduled: "info",
  // neutral
  draft: "neutral", inactive: "neutral", paused: "neutral", archived: "neutral", downloaded: "neutral",
  completed: "neutral", closed: "neutral",
}

const LABELS: Record<string, string> = {
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  pending_approval: "Pending approval",
  partially_refunded: "Partially refunded",
  checked_in: "Checked in",
  no_show: "No-show",
  past_due: "Past due",
}

const key = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_")

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return "neutral"
  return TONES[key(status)] ?? "neutral"
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—"
  const k = key(status)
  if (LABELS[k]) return LABELS[k]
  const words = k.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
