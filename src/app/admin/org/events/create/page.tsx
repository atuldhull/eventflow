"use client"

import { PageHeader } from "@/components/shared/PageHeader"
import { EventWizard } from "@/components/events/EventWizard"
import { useRBAC } from "@/hooks/useRBAC"

export default function CreateEventPage() {
  const { currentOrganizationId } = useRBAC()

  if (!currentOrganizationId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please select an organization first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Event"
        description="Set up a new event for your organization"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Events", href: "/admin/org/events" },
          { label: "Create" },
        ]}
      />
      <EventWizard orgId={currentOrganizationId} mode="create" />
    </div>
  )
}
