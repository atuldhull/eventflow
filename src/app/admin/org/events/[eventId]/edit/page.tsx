"use client"

import { use } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { EventWizard } from "@/components/events/EventWizard"
import { useRBAC } from "@/hooks/useRBAC"

export default function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()

  if (!currentOrganizationId) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Please select an organization first.</p></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Event"
        description="Update your event details"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Events", href: "/admin/org/events" },
          { label: "Edit" },
        ]}
      />
      <EventWizard orgId={currentOrganizationId} mode="edit" initialData={{ id: eventId }} />
    </div>
  )
}
