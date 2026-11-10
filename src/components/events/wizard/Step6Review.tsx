"use client"

import { AlertTriangle, CircleAlert } from "lucide-react"
import { VISIBILITIES, EVENT_TYPES, type ReviewStepProps } from "./shared"
import { WizardSection } from "./Section"

const label = (v: string | undefined | null) => {
  if (!v) return "—"
  const w = v.replace(/_/g, " ").toLowerCase()
  return w.charAt(0).toUpperCase() + w.slice(1)
}

const when = (v: string | undefined) => {
  if (!v) return "Not set"
  const d = new Date(v)
  return isNaN(d.getTime())
    ? v
    : d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-4 py-2.5 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-rule rounded-lg border px-4">{children}</dl>
}

export function Step6Review({ watch, ticketTypes, customFields, faqs, sponsors, addons }: ReviewStepProps) {
  const isOnline = watch("isOnline")
  const isPaid = watch("isPaid")
  const n = (count: number) => <span className="tabular-nums">{count}</span>

  return (
    <div className="space-y-6">
      {(!watch("title") || !watch("startDate") || ticketTypes.some((t) => !t.name)) && (
        <div className="space-y-2">
          {!watch("title") && (
            <p className="flex items-center gap-2 rounded-md bg-pill-negative px-3 py-2.5 text-sm text-pill-negative-foreground" role="alert">
              <CircleAlert className="size-4 shrink-0" aria-hidden /> Event title is required
            </p>
          )}
          {!watch("startDate") && (
            <p className="flex items-center gap-2 rounded-md bg-pill-negative px-3 py-2.5 text-sm text-pill-negative-foreground" role="alert">
              <CircleAlert className="size-4 shrink-0" aria-hidden /> Start date is required
            </p>
          )}
          {ticketTypes.some((t) => !t.name) && (
            <p className="flex items-center gap-2 rounded-md bg-pill-warning px-3 py-2.5 text-sm text-pill-warning-foreground">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> Some ticket types are missing names
            </p>
          )}
        </div>
      )}

      <WizardSection title="Basics" description="Check the details before you publish.">
        <Group>
          <Row k="Title">{watch("title") || "—"}</Row>
          <Row k="Type">{EVENT_TYPES.find((t) => t.value === watch("type"))?.label ?? label(watch("type"))}</Row>
          <Row k="Category">{label(watch("category"))}</Row>
          <Row k="Visibility">{VISIBILITIES.find((v) => v.value === watch("visibility"))?.label ?? label(watch("visibility"))}</Row>
        </Group>
      </WizardSection>

      <WizardSection title="Schedule & venue">
        <Group>
          {/* The inputs hold the event zone's wall clock, so they are shown as typed. */}
          <Row k="Start">{when(watch("startDate"))}</Row>
          <Row k="End">{when(watch("endDate"))}</Row>
          <Row k="Time zone">{(watch("timezone") || "Asia/Kolkata").replace(/_/g, " ")}</Row>
          {(watch("registrationStartDate") || watch("registrationEndDate")) && (
            <Row k="Registration">
              {watch("registrationStartDate") ? when(watch("registrationStartDate")) : "Open now"} – {watch("registrationEndDate") ? when(watch("registrationEndDate")) : "until the event"}
            </Row>
          )}
          <Row k="Venue">{isOnline ? (watch("onlinePlatform") ? label(watch("onlinePlatform")) : "Online") : watch("venue") || "—"}</Row>
          {watch("recurrencePattern") && <Row k="Recurrence">{label(watch("recurrencePattern"))} × {watch("recurrenceCount") || "1"}</Row>}
        </Group>
      </WizardSection>

      <WizardSection title="Tickets & registration">
        {ticketTypes.length > 0 && (
          <ul className="divide-y divide-rule rounded-lg border" aria-label="Ticket types">
            {ticketTypes.map((t, i) => {
              // The wizard saves every price as 0 when the event isn't paid.
              const price = isPaid ? Number(t.price) || 0 : 0
              return (
                <li key={t.id ?? i} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className={t.name ? "font-medium" : "text-muted-foreground italic"}>{t.name || "Unnamed ticket"}</span>
                    {(t.isActive === false || t.isHidden) && (
                      <span className="ml-2 text-[13px] text-muted-foreground">{t.isActive === false ? "Off sale" : "Hidden"}</span>
                    )}
                    {typeof t.quantity === "number" && t.quantity > 0 && (
                      <span className="block text-[13px] text-muted-foreground tabular-nums">{t.quantity.toLocaleString("en-IN")} available</span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free"}</span>
                </li>
              )
            })}
          </ul>
        )}
        <Group>
          <Row k="Pricing">{isPaid ? "Paid" : "Free"}</Row>
          <Row k="Form asks for">
            {["Name", "Email", watch("collectPhone") && "Phone", watch("collectOrganization") && "Organization", watch("collectDepartment") && "Department"].filter(Boolean).join(", ")}
          </Row>
          <Row k="Custom fields">{n(customFields.length)}</Row>
          {watch("allowedEmailDomains") && <Row k="Email restriction">{watch("allowedEmailDomains")}</Row>}
          {watch("maxGuestsPerRegistration") && <Row k="Max guests">{watch("maxGuestsPerRegistration")} per registration</Row>}
          {addons.length > 0 && <Row k="Add-ons">{addons.length} items</Row>}
          {watch("enableDynamicPricing") && <Row k="Dynamic pricing">Enabled</Row>}
          {watch("budgetAmount") && <Row k="Budget"><span className="tabular-nums">₹{parseInt(watch("budgetAmount") || "0").toLocaleString("en-IN")}</span></Row>}
        </Group>
      </WizardSection>

      <WizardSection title="Page extras">
        <Group>
          <Row k="Cover image">{watch("coverImage") ? "Uploaded" : "None"}</Row>
          <Row k="FAQs">{n(faqs.length)}</Row>
          <Row k="Sponsors">{n(sponsors.length)}</Row>
        </Group>
      </WizardSection>
    </div>
  )
}
