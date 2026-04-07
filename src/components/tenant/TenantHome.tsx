import Link from "next/link"
import { Calendar, Building2, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TenantBranding } from "@/lib/tenant"

interface TenantHomeProps {
  branding: TenantBranding
  events: {
    id: string
    title: string
    slug: string
    coverImage: string | null
    category: string | null
    startDate: Date
  }[]
  organizations?: {
    id: string
    name: string
    slug: string
    _count: { events: number }
  }[]
}

export function TenantHome({ branding, events, organizations }: TenantHomeProps) {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-20 bg-zinc-900 text-white">
        <div className="container mx-auto px-4 text-center space-y-6">
          {branding.logo && (
            <img src={branding.logo} alt={branding.name} className="h-16 mx-auto object-contain" />
          )}
          <h1 className="text-3xl sm:text-4xl font-bold">{branding.name}</h1>
          {branding.description && (
            <p className="text-lg text-zinc-300 max-w-2xl mx-auto">{branding.description}</p>
          )}
          <Link href="/events" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
            Browse Events <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Events */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Upcoming Events</h2>
          <Link href="/events" className="text-sm text-primary hover:underline">View All</Link>
        </div>
        {events.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.slug}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-40 bg-muted">
                    {event.coverImage && <img src={event.coverImage} alt={event.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-1">{event.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {event.startDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {event.category && <Badge variant="secondary">{event.category}</Badge>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium">No upcoming events</p>
            <p className="text-sm text-muted-foreground mt-1">Check back soon for new events.</p>
          </Card>
        )}
      </section>

      {/* Organizations */}
      {organizations && organizations.length > 0 && (
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8">Organizations</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {organizations.map((org) => (
                <Card key={org.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {org.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org._count.events} events</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      {branding.description && (
        <section className="container mx-auto px-4 py-16 max-w-3xl">
          <h2 className="text-2xl font-bold mb-4">About {branding.name}</h2>
          <p className="text-muted-foreground leading-relaxed">{branding.description}</p>
        </section>
      )}
    </div>
  )
}
