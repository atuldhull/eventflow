import type { Metadata } from "next"
import { Building2, Calendar, Users, CheckCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Enterprise | EventFlow`,
    description: `View organizations and events for this enterprise on EventFlow`,
  }
}

export default async function EnterprisePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <div>
      <div className="relative h-48 sm:h-56 bg-linear-to-br from-purple-600 to-purple-800">
        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2">
          <div className="container mx-auto px-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white shadow-lg border">
              <Building2 className="h-10 w-10 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-14 pb-16 space-y-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Enterprise</h1>
          <CheckCircle className="h-5 w-5 text-purple-500" />
        </div>
        <p className="text-sm text-muted-foreground">Enterprise details for slug: {slug}</p>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-muted-foreground">Enterprise description will load from the database.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold mb-3">Organizations</h2>
              <Card className="p-8 text-center">
                <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Organizations will appear here.</p>
              </Card>
            </section>
            <section>
              <h2 className="text-lg font-semibold mb-3">Events</h2>
              <Card className="p-8 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No events yet.</p>
              </Card>
            </section>
          </div>
          <Card className="p-6 space-y-3 h-fit">
            <h3 className="text-sm font-medium">Details</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> 0 organizations</div>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> 0 events</div>
              <div className="flex items-center gap-2"><Users className="h-4 w-4" /> 0 members</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
