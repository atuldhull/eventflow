/**
 * Event times in the event's own time zone (Event.timezone, an IANA name such as
 * "Asia/Kolkata"). Instants are stored in UTC; everything here converts for display or for
 * the wizard's datetime-local inputs, which hold a wall-clock time in the event's zone.
 * Pure Intl code, no dependencies; works in the browser and in Node.
 */

export const DEFAULT_EVENT_TIME_ZONE = "Asia/Kolkata"

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** The zone to format in: the event's when valid, else undefined (the viewer's own). */
export const zoneOrUndefined = (tz: string | null | undefined) => (isValidTimeZone(tz) ? tz : undefined)

/** The viewer's zone (browser), or undefined where Intl can't tell. */
export function viewerTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d))

/** `toLocaleString` in the event's zone (falls back to the viewer's when the zone is unknown). */
export function formatInZone(
  d: string | Date,
  tz: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "en-IN"
): string {
  const date = toDate(d)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(locale, { ...options, timeZone: zoneOrUndefined(tz) })
}

/** Milliseconds the zone is ahead of UTC at that instant (e.g. +19800000 for IST). */
export function zoneOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"))
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** True when the event's zone shows a different clock time than the viewer's at that instant. */
export function zoneDiffersFromViewer(tz: string | null | undefined, at: string | Date = new Date(), viewer = viewerTimeZone()): boolean {
  if (!isValidTimeZone(tz) || !isValidTimeZone(viewer)) return false
  const date = toDate(at)
  if (Number.isNaN(date.getTime())) return false
  return zoneOffsetMs(tz, date) !== zoneOffsetMs(viewer, date)
}

/** A short label for the zone at that instant: "IST", "GMT+1", ... */
export function zoneAbbreviation(tz: string | null | undefined, at: string | Date = new Date(), locale = "en-IN"): string {
  const zone = zoneOrUndefined(tz)
  if (!zone) return ""
  const date = toDate(at)
  const part = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "short" })
    .formatToParts(Number.isNaN(date.getTime()) ? new Date() : date)
    .find((p) => p.type === "timeZoneName")
  return part?.value ?? zone
}

/**
 * The note to show next to event times: "IST (Asia/Kolkata)" when the event's zone isn't
 * the viewer's, else null (times already read in the viewer's own clock).
 */
export function zoneNote(tz: string | null | undefined, at: string | Date = new Date(), viewer = viewerTimeZone()): string | null {
  if (!zoneDiffersFromViewer(tz, at, viewer)) return null
  const abbr = zoneAbbreviation(tz, at)
  return abbr && abbr !== tz ? `${abbr} (${tz})` : String(tz)
}

const pad = (n: number) => String(n).padStart(2, "0")

/** A stored instant as a datetime-local value ("YYYY-MM-DDTHH:mm") on the event zone's clock. */
export function toZonedInputValue(d: string | Date | null | undefined, tz: string | null | undefined): string {
  if (!d) return ""
  const date = toDate(d)
  if (Number.isNaN(date.getTime())) return ""
  const zone = zoneOrUndefined(tz)
  if (!zone) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  const shifted = new Date(date.getTime() + zoneOffsetMs(zone, date))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

/** A datetime-local value read as wall-clock time in the event's zone; null when it isn't one. */
export function fromZonedInputValue(value: string | null | undefined, tz: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec((value ?? "").trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[]
  const zone = zoneOrUndefined(tz)
  if (!zone) {
    const local = new Date(y, mo - 1, d, h, mi, s || 0)
    return Number.isNaN(local.getTime()) ? null : local
  }
  const wall = Date.UTC(y, mo - 1, d, h, mi, s || 0)
  // First guess with the offset at the wall time, then correct once across a DST change.
  let utc = wall - zoneOffsetMs(zone, new Date(wall))
  const offset = zoneOffsetMs(zone, new Date(utc))
  if (wall - offset !== utc) utc = wall - offset
  return new Date(utc)
}

/** Every zone the runtime knows (for a picker), the event's current one included. */
export function supportedTimeZones(current?: string): string[] {
  let zones: string[] = []
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []
  } catch {
    zones = []
  }
  if (zones.length === 0) zones = [DEFAULT_EVENT_TIME_ZONE, "UTC"]
  if (current && !zones.includes(current) && isValidTimeZone(current)) zones = [current, ...zones]
  return zones
}
