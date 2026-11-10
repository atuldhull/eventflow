"use client"

import { Download, MapPin, Monitor } from "lucide-react"
import { QRCodeDisplay } from "./QRCodeDisplay"
import { Pill } from "@/components/ui/pill"
import { statusTone } from "@/lib/status-tone"
import { ticketPlace } from "@/lib/ticket-place"
import { cn } from "@/lib/utils"

interface TicketData {
  id: string
  ticketNumber: string
  qrCode: string
  status: string
  event: {
    title: string
    slug: string
    startDate: string
    endDate: string
    venue?: string | null
    venueCity?: string | null
    isOnline: boolean
    /** EventType; HYBRID events show the venue or "Online" per ticket type */
    type?: string | null
    coverImage?: string | null
    organization?: { name: string } | null
  }
  ticketType: { name: string; price: number; currency: string }
  registration: { registrationNumber: string; status: string }
  checkIns?: { checkedInAt: Date }[]
}

interface TicketCardProps {
  ticket: TicketData
  variant?: "compact" | "full"
  onViewTicket?: () => void
  onDownload?: () => void
  /** colour of the surface the ticket sits on, so the perforation notches read as cut-outs */
  notchClassName?: string
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  USED: "Used",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  TRANSFERRED: "Transferred",
}

/**
 * The product's own artefact, drawn as one: a date stub, the admission
 * details, and a QR stub behind a perforated edge. The QR always sits on
 * white so door scanners read it in dark mode too.
 */
export function TicketCard({ ticket, variant = "compact", onViewTicket, onDownload, notchClassName = "bg-background" }: TicketCardProps) {
  const start = new Date(ticket.event.startDate)
  const date = start.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  const time = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  const isCheckedIn = !!ticket.checkIns && ticket.checkIns.length > 0
  const isActive = ticket.status === "ACTIVE"
  const statusLabel = isCheckedIn ? "Attended" : STATUS_LABEL[ticket.status] ?? ticket.status
  const tone = isCheckedIn ? "neutral" : statusTone(ticket.status)
  // In-person and hybrid tickets show the venue; only an online ticket says "Online"
  const where = ticketPlace(ticket.event, ticket.ticketType.name)
  const place = where.label
  const showsOnlineIcon = where.kind === "online"

  if (variant === "full") {
    return (
      <div className="overflow-hidden rounded-xl bg-card">
        <div className="flex flex-col items-center bg-white px-6 pt-6 pb-5 text-[#141b2d]">
          <QRCodeDisplay data={ticket.qrCode} size={232} ticketNumber={ticket.ticketNumber} variant="print" />
          <p className="mt-1 text-[13px] text-[#565c6b]">Show this code at the entrance</p>
        </div>
        <Perforation notchClassName={notchClassName} />
        <div className="space-y-4 px-6 pt-4 pb-6 text-sm">
          <div>
            {ticket.event.organization && <p className="text-[13px] text-muted-foreground">{ticket.event.organization.name}</p>}
            <h3 className="mt-0.5 text-lg leading-snug font-semibold">{ticket.event.title}</h3>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Date">{date}</Field>
            <Field label="Time"><span className="tabular-nums">{time}</span></Field>
            <Field label="Where" span>{place}</Field>
            <Field label="Ticket">{ticket.ticketType.name}</Field>
            <Field label="Status"><Pill tone={tone}>{statusLabel}</Pill></Field>
            <Field label="Registration" span><span className="font-mono text-[13px]">{ticket.registration.registrationNumber}</span></Field>
          </dl>
        </div>
      </div>
    )
  }

  return (
    <article className={cn("group relative flex overflow-hidden rounded-lg border bg-card transition-colors", !isActive && !isCheckedIn && "opacity-75")}>
      {/* date stub */}
      <div className="flex w-[68px] shrink-0 flex-col items-center justify-center border-r bg-frame py-4 leading-none">
        <span className="text-xs text-muted-foreground">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
        <span className="mt-1 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{start.getDate()}</span>
        <span className="mt-1 text-xs text-muted-foreground">{start.toLocaleDateString("en-IN", { weekday: "short" })}</span>
      </div>

      {/* admission details; the whole area opens the ticket */}
      <button
        type="button"
        onClick={onViewTicket}
        className="min-w-0 flex-1 cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:-outline-offset-2"
        aria-label={`Open ticket for ${ticket.event.title}`}
      >
        <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">{ticket.event.title}</h3>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
          {showsOnlineIcon ? <Monitor className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
          <span className="truncate">{place}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums">{time}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill tone={tone}>{statusLabel}</Pill>
          <span className="text-[13px] text-muted-foreground">{ticket.ticketType.name}</span>
        </div>
      </button>

      {/* QR stub behind the perforation */}
      <div className="relative flex w-[104px] shrink-0 flex-col items-center justify-center gap-1.5 border-l-2 border-dashed border-border bg-white p-2.5 sm:w-[118px]">
        <span aria-hidden className={cn("absolute -top-2 -left-[9px] size-4 rounded-full border-b border-border", notchClassName)} />
        <span aria-hidden className={cn("absolute -bottom-2 -left-[9px] size-4 rounded-full border-t border-border", notchClassName)} />
        <QRCodeDisplay data={ticket.qrCode} size={72} showTicketNumber={false} variant="print" />
        <span className="font-mono text-[10.5px] tracking-wide text-[#565c6b]">{ticket.ticketNumber}</span>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="mt-0.5 inline-flex h-7 items-center gap-1 rounded-sm px-1.5 text-xs font-medium text-[#141b2d] hover:bg-[#eceff3] pointer-coarse:h-9"
            aria-label={`Download PDF ticket for ${ticket.event.title}`}
          >
            <Download className="size-3.5" /> PDF
          </button>
        )}
      </div>
    </article>
  )
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn("min-w-0", span && "col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

function Perforation({ notchClassName }: { notchClassName: string }) {
  return (
    <div className="relative h-0 border-t-2 border-dashed border-border" aria-hidden>
      <span className={cn("absolute -top-[9px] -left-2 size-4 rounded-full", notchClassName)} />
      <span className={cn("absolute -top-[9px] -right-2 size-4 rounded-full", notchClassName)} />
    </div>
  )
}
