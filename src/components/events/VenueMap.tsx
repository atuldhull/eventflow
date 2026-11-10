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

  const mapsLink = (tone = "text-brand") => (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${query}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-9 items-center gap-1 rounded-sm text-[14px] font-semibold ${tone} hover:underline pointer-coarse:min-h-11`}
    >
      Open in Google Maps <ArrowUpRight className="size-3.5" aria-hidden />
    </a>
  )

  if (embed) {
    return (
      <div className="overflow-hidden rounded-[22px] border bg-card">
        <iframe src={embed} width="100%" height="320" className="block border-0" loading="lazy" title={`Map of ${venue}`} />
        <div className="flex flex-col gap-1 border-t-2 border-dashed px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="flex min-w-0 items-start gap-2 text-[15px] font-medium">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{place}</span>
          </p>
          <span className="shrink-0 pl-6 sm:pl-0">{mapsLink()}</span>
        </div>
      </div>
    )
  }

  // No coordinates: a designed card instead of an empty map, with the address and directions
  return (
    <div className="relative isolate overflow-hidden rounded-[22px] bg-[#111111] px-6 py-10 text-white sm:px-10 sm:py-12">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 80% 90% at 85% 50%, #000 20%, transparent 75%)",
        }}
      />
      <div aria-hidden className="absolute top-1/2 right-[12%] -z-10 hidden -translate-y-1/2 sm:block">
        <span className="fx-ping absolute inset-0 rounded-full bg-lemon/40" />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-lemon text-lemon-ink shadow-[0_0_60px_-6px_var(--lemon)]">
          <MapPin className="size-7" />
        </span>
      </div>
      <MapPin className="size-6 text-lemon sm:hidden" aria-hidden />
      <p className="font-display mt-3 max-w-[22ch] text-[24px] leading-tight font-extrabold tracking-[-0.03em] sm:mt-0 sm:text-[30px]">{venue}</p>
      {place !== venue && <p className="mt-2 max-w-[48ch] text-[15px] text-white/65">{place}</p>}
      <div className="mt-4">{mapsLink("text-lemon")}</div>
    </div>
  )
}
