"use client"

import { use, useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { EventWizard } from "@/components/events/EventWizard"
import { useRBAC } from "@/hooks/useRBAC"

function formatDatetimeLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 16)
}

export default function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()
  const [eventData, setEventData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}`)
        const json = await res.json()
        if (json.success) {
          const e = json.data
          setEventData({
            id: e.id,
            title: e.title,
            slug: e.slug,
            shortDescription: e.shortDescription || "",
            description: e.description || "",
            type: e.type,
            category: e.category || "",
            tags: e.tags || [],
            visibility: e.visibility,
            startDate: formatDatetimeLocal(e.startDate),
            endDate: formatDatetimeLocal(e.endDate),
            timezone: e.timezone || "Asia/Kolkata",
            registrationStartDate: formatDatetimeLocal(e.registrationStartDate),
            registrationEndDate: formatDatetimeLocal(e.registrationEndDate),
            isOnline: e.isOnline || false,
            venue: e.venue || "",
            venueAddress: e.venueAddress || "",
            venueCity: e.venueCity || "",
            venueState: e.venueState || "",
            venueCountry: e.venueCountry || "",
            onlinePlatform: e.onlinePlatform || "",
            onlineLink: e.onlineLink || "",
            isPaid: e.isPaid || false,
            maxCapacity: e.maxCapacity ? String(e.maxCapacity) : "",
            waitlistEnabled: e.waitlistEnabled || false,
            approvalRequired: e.approvalRequired || false,
            allowTeamRegistration: e.allowTeamRegistration || false,
            minTeamSize: e.minTeamSize ? String(e.minTeamSize) : "",
            maxTeamSize: e.maxTeamSize ? String(e.maxTeamSize) : "",
            coverImage: e.coverImage || "",
            rules: e.rules || "",
            termsAndConditions: e.termsAndConditions || "",
            refundPolicy: e.refundPolicy || "",
            contactEmail: e.contactEmail || "",
            contactPhone: e.contactPhone || "",
            seoTitle: e.seoTitle || "",
            seoDescription: e.seoDescription || "",
            ticketTypes: e.ticketTypes?.map((tt: any) => ({
              name: tt.name,
              description: tt.description || "",
              price: tt.price || 0,
              currency: tt.currency || "INR",
              quantity: tt.quantity,
              maxPerUser: tt.maxPerUser || 1,
              isActive: tt.isActive ?? true,
              isHidden: tt.isHidden ?? false,
              sortOrder: tt.sortOrder || 0,
            })) || [],
            customFormFields: e.customFormFields?.map((f: any) => ({
              label: f.label,
              fieldType: f.fieldType,
              placeholder: f.placeholder || "",
              helpText: f.helpText || "",
              isRequired: f.isRequired || false,
              options: f.options || [],
              sortOrder: f.sortOrder || 0,
            })) || [],
          })
        } else {
          setError(json.message || "Event not found")
        }
      } catch {
        setError("Failed to load event")
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvent()
  }, [currentOrganizationId, eventId])

  if (!currentOrganizationId) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Please select an organization first.</p></div>
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (error) {
    return <div className="text-center py-12"><p className="text-destructive">{error}</p></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Event"
        description={`Editing: ${eventData?.title || "Event"}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Events", href: "/admin/org/events" },
          { label: "Edit" },
        ]}
      />
      <EventWizard orgId={currentOrganizationId} mode="edit" initialData={eventData} />
    </div>
  )
}
