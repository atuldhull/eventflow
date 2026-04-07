"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Ticket, Calendar, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TicketCard } from "@/components/tickets/TicketCard"
import { FullScreenQR } from "@/components/tickets/FullScreenQR"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

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

export default function TicketsPage() {
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null)
  const [showFullScreenQR, setShowFullScreenQR] = useState(false)
  const [tab, setTab] = useState("upcoming")

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch(`/api/users/me/tickets?timeframe=${tab}`)
        const data = await res.json()
        if (data.success) {
          setTickets(data.data || [])
        }
      } catch {
        toast.error("Failed to load tickets")
      } finally {
        setIsLoading(false)
      }
    }
    if (session?.user) fetchTickets()
  }, [session, tab])

  const handleDownload = async (ticketId: string) => {
    window.open(`/api/tickets/${ticketId}/download`, "_blank")
  }

  const upcomingTickets = tickets.filter((t) => t.status === "ACTIVE" && new Date(t.event.startDate) >= new Date())
  const pastTickets = tickets.filter((t) => t.status === "USED" || new Date(t.event.endDate) < new Date())
  const cancelledTickets = tickets.filter((t) => t.status === "CANCELLED")

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tickets"
        description={`${upcomingTickets.length} upcoming ticket${upcomingTickets.length !== 1 ? "s" : ""}`}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcomingTickets.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({pastTickets.length})</TabsTrigger>
          <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : upcomingTickets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {upcomingTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onViewTicket={() => setSelectedTicket(ticket)}
                  onDownload={() => handleDownload(ticket.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Ticket className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No upcoming tickets</p>
              <p className="text-sm text-muted-foreground mt-1">Browse events to find something interesting!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {pastTickets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {pastTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onViewTicket={() => setSelectedTicket(ticket)}
                  onDownload={() => handleDownload(ticket.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No past tickets</p>
              <p className="text-sm text-muted-foreground mt-1">Your attended events will appear here.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {tickets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onViewTicket={() => setSelectedTicket(ticket)}
                  onDownload={() => handleDownload(ticket.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Ticket className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No tickets yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Full Ticket Dialog */}
      <Dialog open={!!selectedTicket && !showFullScreenQR} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-md p-0">
          {selectedTicket && (
            <div>
              <TicketCard ticket={selectedTicket} variant="full" />
              <div className="p-4 border-t flex gap-2">
                <button
                  onClick={() => setShowFullScreenQR(true)}
                  className="flex-1 rounded-lg border p-2 text-sm text-center hover:bg-accent transition-colors"
                >
                  Show to Scanner
                </button>
                <button
                  onClick={() => handleDownload(selectedTicket.id)}
                  className="flex-1 rounded-lg border p-2 text-sm text-center hover:bg-accent transition-colors"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => window.open(`/api/tickets/${selectedTicket.id}/calendar`, "_blank")}
                  className="flex-1 rounded-lg border p-2 text-sm text-center hover:bg-accent transition-colors"
                >
                  Add to Calendar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Screen QR */}
      {showFullScreenQR && selectedTicket && (
        <FullScreenQR
          qrData={selectedTicket.qrCode}
          ticketNumber={selectedTicket.ticketNumber}
          eventTitle={selectedTicket.event.title}
          onClose={() => setShowFullScreenQR(false)}
        />
      )}
    </div>
  )
}
