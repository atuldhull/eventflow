"use client"

import { QrCode, Calendar, ArrowRight } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRBAC } from "@/hooks/useRBAC"

export default function CheckInHubPage() {
  const { currentOrganizationId } = useRBAC()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in"
        description="Scan tickets and manage attendance"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Check-in" },
        ]}
      />

      <div>
        <h3 className="text-sm font-medium mb-3">Today&apos;s Events</h3>
        <Card className="p-8 text-center">
          <QrCode className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium">No events to check in today</p>
          <p className="text-sm text-muted-foreground mt-1">
            Events happening today will appear here with check-in options.
          </p>
          <Link href="/admin/org/events" className={cn(buttonVariants({ variant: "outline" }), "mt-4 gap-2")}>
            <Calendar className="h-4 w-4" /> View Events
          </Link>
        </Card>
      </div>
    </div>
  )
}
