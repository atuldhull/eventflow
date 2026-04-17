"use client"

import { ExternalLink } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { EventData } from "./types"

export function EventSponsors({ sponsors }: { sponsors: EventData["sponsors"] }) {
  if (sponsors.length === 0) return null
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Sponsors</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sponsors.map((sp) => (
          <Card key={sp.id} className="p-4 flex items-center gap-3">
            {sp.logo ? (
              <img src={sp.logo} alt={sp.name} className="h-10 w-10 rounded-md object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{sp.name[0]}</div>
            )}
            <div>
              <p className="text-sm font-medium">{sp.name}</p>
              <Badge variant="outline" className="text-[10px]">{sp.tier}</Badge>
            </div>
            {sp.website && (
              <a href={sp.website} target="_blank" rel="noopener noreferrer" className="ml-auto text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </Card>
        ))}
      </div>
    </section>
  )
}
