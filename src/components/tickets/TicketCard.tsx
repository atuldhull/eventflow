"use client"

import { Calendar, MapPin, Monitor, Download } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { QRCodeDisplay } from "./QRCodeDisplay"
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
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  USED: { label: "Used", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  EXPIRED: { label: "Expired", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  TRANSFERRED: { label: "Transferred", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
}

export function TicketCard({ ticket, variant = "compact", onViewTicket, onDownload }: TicketCardProps) {
  const date = new Date(ticket.event.startDate).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const time = new Date(ticket.event.startDate).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  })
  const status = statusConfig[ticket.status] || statusConfig.ACTIVE
  const isCheckedIn = ticket.checkIns && ticket.checkIns.length > 0
  const isActive = ticket.status === "ACTIVE"

  if (variant === "full") {
    return (
      <Card className="overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex justify-center">
            <QRCodeDisplay data={ticket.qrCode} size={250} ticketNumber={ticket.ticketNumber} />
          </div>
          <p className="text-center text-sm text-muted-foreground">Scan this code at the event entrance</p>

          <div className="space-y-3 text-sm">
            <div>
              <h3 className="text-lg font-semibold">{ticket.event.title}</h3>
              {ticket.event.organization && (
                <p className="text-muted-foreground">by {ticket.event.organization.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" /> {date} at {time}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {ticket.event.isOnline ? <Monitor className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                {ticket.event.isOnline ? "Online" : ticket.event.venue || ticket.event.venueCity || "TBA"}
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Ticket</span>
              <span className="font-medium">{ticket.ticketType.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registration</span>
              <span className="font-mono text-xs">{ticket.registration.registrationNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary" className={status.className}>{status.label}</Badge>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  // Compact variant
  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer hover:shadow-md transition-shadow",
        !isActive && "opacity-70"
      )}
      onClick={onViewTicket}
    >
      <div className="flex">
        {/* Left: Event info */}
        <div className="flex-1 p-4 space-y-2">
          <h3 className="font-semibold line-clamp-1">{ticket.event.title}</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> {date}
            </div>
            <div className="flex items-center gap-1.5">
              {ticket.event.isOnline ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              {ticket.event.isOnline ? "Online" : ticket.event.venueCity || ticket.event.venue || "TBA"}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className={cn("text-[10px]", status.className)}>{isCheckedIn ? "Attended" : status.label}</Badge>
            <span className="text-xs text-muted-foreground">{ticket.ticketType.name}</span>
          </div>
        </div>

        {/* Right: QR + ticket number */}
        <div className="flex flex-col items-center justify-center border-l border-dashed p-3 bg-muted/30 w-32">
          <QRCodeDisplay data={ticket.qrCode} size={80} showTicketNumber={false} variant="print" />
          <p className="text-[10px] font-mono mt-1.5 text-muted-foreground">{ticket.ticketNumber}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t text-xs">
        <button onClick={(e) => { e.stopPropagation(); onViewTicket?.() }} className="flex-1 py-2 text-center hover:bg-accent transition-colors">View</button>
        <div className="w-px bg-border" />
        <button onClick={(e) => { e.stopPropagation(); onDownload?.() }} className="flex-1 py-2 text-center hover:bg-accent transition-colors flex items-center justify-center gap-1">
          <Download className="h-3 w-3" /> Download
        </button>
      </div>
    </Card>
  )
}
