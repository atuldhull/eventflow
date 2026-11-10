"use client"

import { ArrowUpRight, MapPin } from "lucide-react"

interface VenueMapProps {
  venue: string
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}

const isCoord = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max

/**
 * Shows the venue on an OpenStreetMap embed when the event has coordinates.
 * The old embed always passed an empty bbox/marker, so it rendered a generic
 * world map instead of the venue; without coordinates we now show the address
 * and the directions link only.
 */
export function VenueMap({ venue, address, city, state, country, latitude, longitude }: VenueMapProps) {
  const place = [venue, address, city, state, country].filter(Boolean).join(", ")
  const query = encodeURIComponent(place)
  const hasPoint = isCoord(latitude, 90) && isCoord(longitude, 180)

  let embed: string | null = null
  if (hasPoint) {
    const d = 0.006 // ~600 m around the venue
    const bbox = [longitude - d, latitude - d, longitude + d, latitude + d].map((n) => n.toFixed(5)).join(",")
    embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(5)},${longitude.toFixed(5)}`
  }

  const mapsLink = (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${query}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-9 items-center gap-1 rounded-sm text-[13px] font-medium text-brand hover:underline pointer-coarse:min-h-11"
    >
      Open in Google Maps <ArrowUpRight className="size-3.5" aria-hidden />
    </a>
  )

  if (embed) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <iframe src={embed} width="100%" height="260" className="block border-0" loading="lazy" title={`Map of ${venue}`} />
        <div className="flex flex-col gap-1 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="flex min-w-0 items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{place}</span>
          </p>
          <span className="shrink-0 pl-6 sm:pl-0">{mapsLink}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-rule bg-raised px-6 py-10 text-center">
      <MapPin className="size-5 text-muted-foreground" aria-hidden />
      <p className="mt-3 max-w-[48ch] text-sm font-medium">{place}</p>
      <div className="mt-1">{mapsLink}</div>
    </div>
  )
}
