import { Suspense } from "react"
import { Calendar, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
  title: "Discover Events | EventFlow",
  description: "Find and register for events happening near you. Browse workshops, hackathons, conferences, and more.",
}

const CATEGORIES = ["All", "Tech", "Cultural", "Sports", "Workshop", "Hackathon", "Conference", "Seminar", "Webinar", "Fest", "Competition"]

export default function EventsPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Discover Events</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Find events happening near you. Workshops, hackathons, conferences, and more.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search events by title, category, or keyword..." className="pl-10 h-11" />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={cat === "All" ? "default" : "secondary"}
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1"
          >
            {cat}
          </Badge>
        ))}
      </div>

      {/* Events Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Empty state */}
        <div className="col-span-full text-center py-16">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">No events yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Check back soon for upcoming events on the platform.
          </p>
        </div>
      </div>
    </div>
  )
}
