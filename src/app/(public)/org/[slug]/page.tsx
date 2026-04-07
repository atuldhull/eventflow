import type { Metadata } from "next"
import Link from "next/link"
import { Building2, Calendar, Users, Globe, CheckCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Organization | EventFlow`,
    description: `View events and details for this organization on EventFlow`,
  }
}

export default async function OrgPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <div>
      {/* Hero */}
      <div className="relative h-48 sm:h-56 bg-linear-to-br from-blue-600 to-blue-800">
        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2">
          <div className="container mx-auto px-4">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white shadow-lg border">
                <Building2 className="h-10 w-10 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-14 pb-16 space-y-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Organization</h1>
            <CheckCircle className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Organization details for slug: {slug}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-muted-foreground">Organization description will appear here when connected to the database.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Upcoming Events</h2>
              <Card className="p-8 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming events.</p>
              </Card>
            </section>
          </div>

          <div className="space-y-4">
            <Card className="p-6 space-y-3">
              <h3 className="text-sm font-medium">Details</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Users className="h-4 w-4" /> 0 members</div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> 0 events</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
