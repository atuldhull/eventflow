import { MapPin } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import { QrGlyph } from "./QrGlyph"

export interface SampleTicketData {
  month: string
  day: number
  weekday: string
  title: string
  venue: string
  /** any status string the product uses; drawn with the shared pill tones */
  status: string
  ticketType: string
  code: string
}

/**
 * An illustration of the product's ticket (static sample content): a date
 * stub, the admission details, and a white QR stub behind a perforated edge.
 * Mirrors the compact TicketCard so the marketing site shows the real thing.
 */
export function SampleTicket({
  ticket,
  notchClassName = "bg-frame",
  className,
}: {
  ticket: SampleTicketData
  /** colour of the surface behind the ticket, so the notches read as cut-outs */
  notchClassName?: string
  className?: string
}) {
  return (
    <div className={cn("flex overflow-hidden rounded-lg border bg-card text-left text-card-foreground", className)}>
      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center border-r bg-frame py-3 leading-none sm:w-[68px]">
        <span className="text-xs text-muted-foreground">{ticket.month}</span>
        <span className="mt-1 text-[24px] font-semibold tracking-[-0.02em] tabular-nums sm:text-[26px]">{ticket.day}</span>
        <span className="mt-1 text-xs text-muted-foreground">{ticket.weekday}</span>
      </div>

      <div className="min-w-0 flex-1 px-3.5 py-3.5 sm:px-4">
        <p className="line-clamp-2 text-[15px] leading-snug font-semibold">{ticket.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{ticket.venue}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Pill tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Pill>
          <span className="text-[13px] text-muted-foreground">{ticket.ticketType}</span>
        </div>
      </div>

      {/* the QR always sits on white paper, in dark mode too */}
      <div className="relative flex w-[88px] shrink-0 flex-col items-center justify-center gap-1.5 border-l-2 border-dashed border-border bg-white p-2.5 sm:w-[108px]">
        <span aria-hidden className={cn("absolute -top-2 -left-[9px] size-4 rounded-full border-b border-border", notchClassName)} />
        <span aria-hidden className={cn("absolute -bottom-2 -left-[9px] size-4 rounded-full border-t border-border", notchClassName)} />
        <QrGlyph seed={ticket.code} className="size-14 text-[#171717] sm:size-16" />
        <span className="font-mono text-[10px] tracking-wide text-[#565c6b] sm:text-[10.5px]">{ticket.code}</span>
      </div>
    </div>
  )
}
