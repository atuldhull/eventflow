"use client"

import { Badge } from "@/components/ui/badge"
import { statusConfig, type EventData } from "./types"

export function EventHero({ event }: { event: EventData }) {
  const status = statusConfig[event.status] || statusConfig.PUBLISHED
  return (
    <div className="relative h-64 sm:h-80 lg:h-96 bg-linear-to-br from-primary/20 to-primary/5 overflow-hidden">
      {event.coverImage && <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover absolute inset-0" />}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className={status.color}>{status.label}</Badge>
            <Badge variant="secondary">{event.category}</Badge>
            {event.isFeatured && <Badge className="bg-amber-500 text-white">Featured</Badge>}
            {event.type !== "SINGLE" && <Badge variant="outline" className="border-white/30 text-white">{event.type.replace(/_/g, " ")}</Badge>}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{event.title}</h1>
          <p className="text-white/80 mt-2 max-w-2xl text-sm sm:text-base">{event.shortDescription}</p>
          <div className="flex items-center gap-3 mt-3 text-white/70 text-sm">
            <span>by {event.organization.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
