export function generateICSFile(event: {
  title: string
  description?: string
  startDate: Date
  endDate: Date
  venue?: string | null
  venueAddress?: string | null
  isOnline?: boolean
  onlineLink?: string | null
  onlinePlatform?: string | null
  slug?: string
  organizerName?: string
  organizerEmail?: string
}, ticketNumber?: string): string {
  const uid = `${event.slug || Date.now()}@eventflow.com`
  const now = formatICSDate(new Date())

  const location = event.isOnline
    ? `Online via ${event.onlinePlatform || "Virtual Platform"}`
    : [event.venue, event.venueAddress].filter(Boolean).join(", ") || "TBA"

  let description = event.description || event.title
  if (ticketNumber) description += `\\nTicket: ${ticketNumber}`
  if (event.isOnline && event.onlineLink) description += `\\nJoin: ${event.onlineLink}`
  description = description.replace(/\n/g, "\\n").slice(0, 500)

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventFlow//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(event.endDate)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    event.slug ? `URL:${process.env.NEXT_PUBLIC_APP_URL || "https://eventflow.com"}/events/${event.slug}` : "",
    event.organizerName ? `ORGANIZER;CN=${escapeICS(event.organizerName)}:MAILTO:${event.organizerEmail || "events@eventflow.com"}` : "",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Event tomorrow: ${escapeICS(event.title)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Event starting soon: ${escapeICS(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n")
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, "\\n")
}

export function getGoogleCalendarUrl(event: {
  title: string
  description?: string
  startDate: Date
  endDate: Date
  venue?: string | null
  isOnline?: boolean
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`,
    details: event.description || "",
    location: event.isOnline ? "Online" : event.venue || "",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}
