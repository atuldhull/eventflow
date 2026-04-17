"use client"

import { MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fmtTime, type EventData } from "./types"

export function EventSchedule({ sessions }: { sessions: EventData["sessions"] }) {
  if (sessions.length === 0) return null
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Schedule</h2>
      <div className="space-y-3">
        {sessions.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">{s.title}</p>
                {s.speaker && <p className="text-sm text-primary">{s.speaker}</p>}
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                {s.venue && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.venue}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">{fmtTime(s.startTime)}</p>
                <p className="text-xs text-muted-foreground">to {fmtTime(s.endTime)}</p>
                {s.track && <Badge variant="outline" className="text-[10px] mt-1">{s.track}</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
