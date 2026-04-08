"use client"

interface VenueMapProps {
  venue: string
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
}

export function VenueMap({ venue, address, city, state, country }: VenueMapProps) {
  const query = encodeURIComponent([venue, address, city, state, country].filter(Boolean).join(", "))

  return (
    <div className="rounded-lg overflow-hidden border">
      <iframe
        src={`https://www.openstreetmap.org/export/embed.html?bbox=&layer=mapnik&marker=&mlat=&mlon=`}
        width="100%"
        height="200"
        className="border-0"
        loading="lazy"
        title="Event venue map"
      />
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center py-2 text-xs text-primary hover:underline bg-muted/30"
      >
        Open in Google Maps →
      </a>
    </div>
  )
}
