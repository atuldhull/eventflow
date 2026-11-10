"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Download } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { RegistrationsManager } from "../events/_components/registrations-manager"

function OrgRegistrations() {
  const { currentOrganizationId } = useRBAC()
  // ?status=PENDING (e.g. from the overview's pending actions) opens the page filtered.
  const initialStatus = useSearchParams().get("status")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description="All registrations across your events"
        actions={
          <PermissionGate permission={PERMISSIONS.REGISTRATION_EXPORT}>
            <Button
              variant="outline"
              onClick={() => window.open(`/api/admin/org/${currentOrganizationId}/registrations/export`)}
              disabled={!currentOrganizationId}
            >
              <Download /> Export CSV
            </Button>
          </PermissionGate>
        }
      />
      <RegistrationsManager orgId={currentOrganizationId} initialStatus={initialStatus} />
    </div>
  )
}

export default function OrgRegistrationsPage() {
  return (
    <Suspense>
      <OrgRegistrations />
    </Suspense>
  )
}
