"use client"

import { Download, MapPin, Monitor } from "lucide-react"
import { QRCodeDisplay } from "./QRCodeDisplay"
import { Perforation } from "./Perforation"
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
  const month = start.toLocaleDateString("en-IN", { month: "short" })
  const weekday = start.toLocaleDateString("en-IN", { weekday: "short" })

  if (variant === "full") {
    return (
      <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
        {/* the admission: a lemon date tile, who runs it, the title in display type */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className="flex w-[60px] shrink-0 flex-col items-center rounded-xl bg-lemon py-2 leading-none text-lemon-ink">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">{month}</span>
              <span className="font-display mt-1 text-[28px] font-extrabold tracking-[-0.04em] tabular-nums">{start.getDate()}</span>
              <span className="mt-1 text-[11px] font-medium">{weekday}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] text-muted-foreground">{ticket.event.organization?.name}</p>
                <Pill tone={tone} className="shrink-0">{statusLabel}</Pill>
              </div>
              <h3 className="font-display mt-1 text-[22px] leading-[1.08] font-bold tracking-[-0.03em]">{ticket.event.title}</h3>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Date">{date}</Field>
            <Field label="Time"><span className="tabular-nums">{time}</span></Field>
            <Field label="Where" span>{place}</Field>
            <Field label="Ticket">{ticket.ticketType.name}</Field>
            <Field label="Status">{statusLabel}</Field>
            <Field label="Registration" span><span className="font-mono text-[13px]">{ticket.registration.registrationNumber}</span></Field>
          </dl>
        </div>
        <Perforation notchClassName={notchClassName} />
        {/* the stub the door scans */}
        <div className="flex flex-col items-center bg-white px-6 pt-5 pb-5 text-[#171717]">
          <QRCodeDisplay data={ticket.qrCode} size={216} ticketNumber={ticket.ticketNumber} variant="print" />
          <p className="mt-1 text-[13px] text-[#565c6b]">Show this code at the entrance</p>
        </div>
      </div>
    )
  }

  return (
    <article className={cn("group relative flex overflow-hidden rounded-xl border bg-card transition-colors hover:border-input", !isActive && !isCheckedIn && "opacity-75")}>
      {/* date stub */}
      <div className="flex w-[68px] shrink-0 flex-col items-center justify-center border-r bg-frame py-4 leading-none">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{month}</span>
        <span className="font-display mt-1 text-[28px] font-extrabold tracking-[-0.04em] tabular-nums">{start.getDate()}</span>
        <span className="mt-1 text-xs text-muted-foreground">{weekday}</span>
      </div>

      {/* admission details; the whole area opens the ticket */}
      <button
        type="button"
        onClick={onViewTicket}
        className="min-w-0 flex-1 cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:-outline-offset-2"
        aria-label={`Open ticket for ${ticket.event.title}`}
      >
        <h3 className="font-display line-clamp-2 text-[16px] leading-snug font-bold tracking-[-0.015em]">{ticket.event.title}</h3>
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
            className="mt-0.5 inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-[#171717] hover:bg-[#eceff3] pointer-coarse:h-9"
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
      <dd className="mt-0.5 font-medium break-words">{children}</dd>
    </div>
  )
}
