"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"

interface TicketType {
  id: string
  name: string
  description?: string | null
  price: number
  currency: string
  quantity?: number | null
  sold: number
  maxPerUser: number
  isActive: boolean
}

interface TicketSelectorProps {
  ticketTypes: TicketType[]
  onSelect: (selections: Record<string, number>) => void
  selectedTickets: Record<string, number>
}

export function TicketSelector({ ticketTypes, onSelect, selectedTickets }: TicketSelectorProps) {
  const updateQuantity = (ticketId: string, delta: number, max: number) => {
    const current = selectedTickets[ticketId] || 0
    const newQty = Math.max(0, Math.min(current + delta, max))
    onSelect({ ...selectedTickets, [ticketId]: newQty })
  }

  const total = ticketTypes.reduce((sum, tt) => {
    return sum + (selectedTickets[tt.id] || 0) * tt.price
  }, 0)

  return (
    <div className="space-y-2.5">
      {ticketTypes.filter((t) => t.isActive).map((ticket) => {
        const remaining = ticket.quantity ? ticket.quantity - ticket.sold : null
        const isSoldOut = remaining !== null && remaining <= 0
        const selected = selectedTickets[ticket.id] || 0

        return (
          <div
            key={ticket.id}
            className={cn(
              "rounded-lg border bg-card p-4 transition-colors",
              selected > 0 && "border-primary ring-1 ring-primary",
              isSoldOut && "bg-raised text-muted-foreground"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{ticket.name}</p>
                {ticket.description && (
                  <p className="text-[13px] text-muted-foreground">{ticket.description}</p>
                )}
                {remaining !== null && remaining > 0 && remaining <= 10 && (
                  <p className={cn("text-[13px] tabular-nums", remaining <= 5 ? "text-destructive" : "text-muted-foreground")}>{remaining} left</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="text-sm font-semibold tabular-nums">
                  {ticket.price > 0 ? `₹${ticket.price.toLocaleString("en-IN")}` : "Free"}
                </p>
                {isSoldOut && <Pill tone="neutral">Sold out</Pill>}
              </div>
            </div>

            {!isSoldOut && (
              <div className="mt-3 flex items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Fewer ${ticket.name} tickets`}
                  onClick={() => updateQuantity(ticket.id, -1, ticket.maxPerUser)}
                  disabled={selected <= 0}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-9 text-center text-sm font-medium tabular-nums" aria-live="polite">{selected}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`More ${ticket.name} tickets`}
                  onClick={() => updateQuantity(ticket.id, 1, ticket.maxPerUser)}
                  disabled={selected >= ticket.maxPerUser || (remaining !== null && selected >= remaining)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {total > 0 && (
        <div className="flex items-center justify-between border-t border-rule pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">₹{total.toLocaleString("en-IN")}</span>
        </div>
      )}
    </div>
  )
}
