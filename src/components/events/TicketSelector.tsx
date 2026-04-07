"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
    <div className="space-y-3">
      {ticketTypes.filter((t) => t.isActive).map((ticket) => {
        const remaining = ticket.quantity ? ticket.quantity - ticket.sold : null
        const isSoldOut = remaining !== null && remaining <= 0
        const selected = selectedTickets[ticket.id] || 0

        return (
          <div
            key={ticket.id}
            className={cn(
              "rounded-lg border p-4 transition-colors",
              selected > 0 && "border-primary bg-primary/5",
              isSoldOut && "opacity-50"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-medium">{ticket.name}</p>
                {ticket.description && (
                  <p className="text-xs text-muted-foreground">{ticket.description}</p>
                )}
                {remaining !== null && remaining > 0 && remaining <= 10 && (
                  <p className="text-xs text-amber-600 font-medium">Only {remaining} left!</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {ticket.price > 0 ? `₹${ticket.price.toLocaleString("en-IN")}` : "Free"}
                </p>
                {isSoldOut && <Badge variant="secondary" className="mt-1">Sold Out</Badge>}
              </div>
            </div>

            {!isSoldOut && (
              <div className="flex items-center justify-end gap-2 mt-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => updateQuantity(ticket.id, -1, ticket.maxPerUser)}
                  disabled={selected <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">{selected}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => updateQuantity(ticket.id, 1, ticket.maxPerUser)}
                  disabled={selected >= ticket.maxPerUser || (remaining !== null && selected >= remaining)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {total > 0 && (
        <div className="flex justify-between items-center pt-3 border-t">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold">₹{total.toLocaleString("en-IN")}</span>
        </div>
      )}
    </div>
  )
}
