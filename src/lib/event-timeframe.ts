/**
 * Where an event sits in time for an attendee: not started yet, running now, or ended.
 * An event counts as "live" from its start until its end, so its ticket stays with the
 * upcoming ones (as happening now) instead of disappearing while the event runs.
 */
export type EventTimeframe = "upcoming" | "live" | "past"

export function eventTimeframe(
  event: { startDate: string | Date; endDate?: string | Date | null },
  now: Date = new Date()
): EventTimeframe {
  const start = new Date(event.startDate).getTime()
  // an event without a usable end date ends when it starts
  const parsedEnd = event.endDate ? new Date(event.endDate).getTime() : NaN
  const end = Number.isNaN(parsedEnd) ? start : Math.max(start, parsedEnd)
  const t = now.getTime()
  if (t > end) return "past"
  if (t >= start) return "live"
  return "upcoming"
}

/** Not ended yet: upcoming or happening now. */
export const isCurrent = (event: { startDate: string | Date; endDate?: string | Date | null }, now?: Date) =>
  eventTimeframe(event, now) !== "past"
