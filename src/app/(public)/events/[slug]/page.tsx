import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Calendar, MapPin, Monitor, Users, Clock, Share2, ArrowLeft, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Event | EventFlow`,
    description: "View event details and register",
    openGraph: {
      title: "Event | EventFlow",
      description: "View event details and register on EventFlow",
      type: "website",
    },
  }
}

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <div>
      {/* Hero */}
      <div className="relative h-64 sm:h-80 lg:h-96 bg-linear-to-br from-primary/20 to-primary/5">
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12">
          <div className="container mx-auto">
            <Badge className="bg-white/90 text-foreground mb-3">Event</Badge>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              Event Details
            </h1>
            <p className="text-white/80 mt-2 max-w-2xl text-sm sm:text-base">
              Event details will load when connected to the database. Slug: {slug}
            </p>
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Date TBA</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Location TBA</span>
          </div>
          <Link href={`/events/${slug}/register`} className={cn(buttonVariants(), "gap-2")}>
            Register Now
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3">About This Event</h2>
              <p className="text-muted-foreground leading-relaxed">
                Event description will appear here when event data is loaded from the database.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">FAQs</h2>
              <p className="text-sm text-muted-foreground">No FAQs available for this event.</p>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Registration Card */}
            <Card className="p-6 space-y-4 sticky top-20">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-600">Registration Open</span>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <p className="font-medium">Free Event</p>
                <p className="text-muted-foreground">No tickets configured yet.</p>
              </div>

              <Link href={`/events/${slug}/register`} className={cn(buttonVariants(), "w-full")}>
                Register for Free
              </Link>

              <p className="text-xs text-center text-muted-foreground">
                By registering, you agree to the event terms and conditions.
              </p>
            </Card>

            {/* Event Details Card */}
            <Card className="p-6 space-y-3">
              <h3 className="text-sm font-medium">Event Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Date to be announced</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Time to be announced</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Location to be announced</span>
                </div>
              </div>
            </Card>

            {/* Organizer Card */}
            <Card className="p-6 space-y-3">
              <h3 className="text-sm font-medium">Organizer</h3>
              <p className="text-sm text-muted-foreground">Organization details will appear here.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
