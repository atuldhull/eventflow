"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EventWizard } from "@/components/events/EventWizard"
import { useRBAC } from "@/hooks/useRBAC"
import { toZonedInputValue } from "@/lib/event-time"

// The wizard's datetime-local inputs hold the event zone's wall clock and are read back in
// that zone (fromZonedInputValue), so they are filled in the same zone. Formatting in UTC
// (toISOString) or in the viewer's zone shifted the event on every save.
const formatDatetimeLocal = toZonedInputValue

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
          // Wizard settings that live in event.settings (JSON); see src/lib/event-update.ts.
          const s = (e.settings && typeof e.settings === "object" ? e.settings : {}) as Record<string, any>
          const str = (v: unknown) => (v === null || v === undefined ? "" : String(v))
          setEventData({
            id: e.id,
            status: e.status,
            allowedEmailDomains: str(s.allowedEmailDomains),
            recurrencePattern: str(s.recurrencePattern),
            recurrenceCount: str(s.recurrenceCount),
            budgetAmount: str(s.budgetAmount),
            budgetNotes: str(s.budgetNotes),
            maxGuestsPerRegistration: str(s.maxGuestsPerRegistration),
            enableDynamicPricing: !!s.enableDynamicPricing,
            dynamicPricingTiers: str(s.dynamicPricingTiers),
            collectPhone: e.registrationFields?.phone ?? true,
            collectOrganization: e.registrationFields?.organization ?? false,
            collectDepartment: e.registrationFields?.department ?? false,
            addons: Array.isArray(s.addons) ? s.addons : [],
            faqs: e.faqs?.map((f: any) => ({ question: f.question, answer: f.answer })) || [],
            sponsors: e.sponsors?.map((sp: any) => ({ name: sp.name, tier: sp.tier || "", website: sp.website || "" })) || [],
            title: e.title,
            slug: e.slug,
            shortDescription: e.shortDescription || "",
            description: e.description || "",
            type: e.type,
            category: e.category || "",
            tags: e.tags || [],
            visibility: e.visibility,
            startDate: formatDatetimeLocal(e.startDate, e.timezone),
            endDate: formatDatetimeLocal(e.endDate, e.timezone),
            timezone: e.timezone || "Asia/Kolkata",
            registrationStartDate: formatDatetimeLocal(e.registrationStartDate, e.timezone),
            registrationEndDate: formatDatetimeLocal(e.registrationEndDate, e.timezone),
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
              // Kept so a save updates this ticket type in place (its sold count and registrations stay).
              id: tt.id,
              name: tt.name,
              description: tt.description || "",
              price: Number(tt.price) || 0,
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
    return <EmptyState variant="page" title="Please select an organization first." />
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading event">
        <div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-64" /></div>
        <Skeleton className="h-10 w-full max-w-4xl" />
        <Skeleton className="h-80 w-full max-w-4xl rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState variant="page" title={error}>
        <Link href="/admin/org/events" className={buttonVariants({ variant: "outline" })}>Back to events</Link>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit event"
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
