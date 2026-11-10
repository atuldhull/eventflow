"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Download, UserPlus } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button, buttonVariants } from "@/components/ui/button"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { AddParticipantDialog, type TicketOption } from "../../_components/registration-admin"
import { RegistrationsManager } from "../../_components/registrations-manager"

const OPEN_FOR_ADDING = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"]

export default function EventRegistrationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()
  const [event, setEvent] = useState<{ title: string; status: string; ticketTypes: TicketOption[] } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // The event's name and ticket types (for "Add participant"); a re-fetch after an add
  // picks up the new sold counts.
  useEffect(() => {
    if (!currentOrganizationId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}`)
        const json = await res.json()
        if (!cancelled && json.success) {
          setEvent({ title: json.data.title, status: json.data.status, ticketTypes: json.data.ticketTypes ?? [] })
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [currentOrganizationId, eventId, refreshKey])

  const canAdd = !!event && OPEN_FOR_ADDING.includes(event.status)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description={event?.title ? `${event.title} · participants registered for this event` : "Participants registered for this event"}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Events", href: "/admin/org/events" }, { label: "Registrations" }]}
        actions={
          <>
            <Link href={`/admin/org/events/${eventId}`} className={buttonVariants({ variant: "ghost" })}>
              <ArrowLeft /> Back to event
            </Link>
            <PermissionGate permission={PERMISSIONS.REGISTRATION_EXPORT}>
              <Button
                variant="outline"
                onClick={() => window.open(`/api/admin/org/${currentOrganizationId}/registrations/export?eventId=${encodeURIComponent(eventId)}`)}
                disabled={!currentOrganizationId}
              >
                <Download /> Export CSV
              </Button>
            </PermissionGate>
            {canAdd && (
              <PermissionGate permission={PERMISSIONS.REGISTRATION_ADD_MANUAL}>
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus /> Add participant
                </Button>
              </PermissionGate>
            )}
          </>
        }
      />

      <RegistrationsManager orgId={currentOrganizationId} eventId={eventId} refreshKey={refreshKey} />

      <AddParticipantDialog
        orgId={currentOrganizationId}
        eventId={eventId}
        ticketTypes={event?.ticketTypes ?? []}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => setRefreshKey((n) => n + 1)}
      />
    </div>
  )
}
