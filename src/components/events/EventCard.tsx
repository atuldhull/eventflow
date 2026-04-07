import Link from "next/link"
import { Calendar, MapPin, Monitor, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EventCardProps {
  event: {
    id: string
    slug: string
    title: string
    shortDescription?: string | null
    coverImage?: string | null
    category?: string | null
    startDate: string
    venue?: string | null
    venueCity?: string | null
    isOnline: boolean
    isPaid: boolean
    currentRegistrations: number
    maxCapacity?: number | null
    status: string
    isFeatured?: boolean
    organization?: { name: string } | null
  }
  variant?: "default" | "compact" | "featured"
}

const categoryColors: Record<string, string> = {
  TECH: "bg-blue-500",
  CULTURAL: "bg-pink-500",
  SPORTS: "bg-green-500",
  WORKSHOP: "bg-amber-500",
  HACKATHON: "bg-purple-500",
  CONFERENCE: "bg-indigo-500",
  SEMINAR: "bg-teal-500",
}

export function EventCard({ event, variant = "default" }: EventCardProps) {
  const formattedDate = new Date(event.startDate).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const spotsLeft = event.maxCapacity ? event.maxCapacity - event.currentRegistrations : null
  const showSpotsWarning = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= Math.ceil((event.maxCapacity || 0) * 0.2)

  return (
    <Link href={`/events/${event.slug}`}>
      <Card className={cn(
        "group overflow-hidden transition-all hover:shadow-md",
        variant === "featured" && "border-2 border-primary/20"
      )}>
        {/* Cover Image */}
        <div className={cn("relative overflow-hidden bg-muted", variant === "featured" ? "h-52" : "h-40")}>
          {event.coverImage ? (
            <img src={event.coverImage} alt={event.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className={cn("h-full w-full", categoryColors[event.category || ""] || "bg-gradient-to-br from-primary/20 to-primary/5")} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3">
            {event.category && <Badge className="bg-white/90 text-foreground text-xs">{event.category}</Badge>}
          </div>
          <div className="absolute top-3 right-3">
            {!event.isPaid && <Badge className="bg-green-500 text-white text-xs">Free</Badge>}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className={cn("font-semibold line-clamp-2", variant === "featured" ? "text-lg" : "text-sm")}>
            {event.title}
          </h3>

          {variant !== "compact" && event.shortDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2">{event.shortDescription}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1">
              {event.isOnline ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              {event.isOnline ? "Online" : event.venueCity || event.venue || "TBA"}
            </span>
          </div>

          {event.organization && (
            <p className="text-xs text-muted-foreground">by {event.organization.name}</p>
          )}

          {showSpotsWarning && (
            <p className="text-xs text-amber-600 font-medium">Only {spotsLeft} spots left!</p>
          )}
        </div>
      </Card>
    </Link>
  )
}
