"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { ReviewStepProps } from "./shared"

export function Step6Review({ watch, ticketTypes, customFields, faqs, sponsors, addons }: ReviewStepProps) {
  const isOnline = watch("isOnline")
  const isPaid = watch("isPaid")

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-3">Event Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="font-medium">{watch("title") || "—"}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><Badge variant="secondary">{watch("type")}</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Category</span><Badge variant="secondary">{watch("category") || "—"}</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Visibility</span><Badge variant="outline">{watch("visibility")}</Badge></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{watch("startDate") || "Not set"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{watch("endDate") || "Not set"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span>{isOnline ? watch("onlinePlatform") || "Online" : watch("venue") || "—"}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Ticket Types</span><span>{ticketTypes.length}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pricing</span><span>{isPaid ? "Paid" : "Free"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Custom Fields</span><span>{customFields.length}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">FAQs</span><span>{faqs.length}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sponsors</span><span>{sponsors.length}</span></div>
          {watch("allowedEmailDomains") && <div className="flex justify-between"><span className="text-muted-foreground">Email Restriction</span><span className="text-xs">{watch("allowedEmailDomains")}</span></div>}
          {watch("budgetAmount") && <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span>&#8377;{parseInt(watch("budgetAmount") || "0").toLocaleString("en-IN")}</span></div>}
          {watch("maxGuestsPerRegistration") && <div className="flex justify-between"><span className="text-muted-foreground">Max Guests</span><span>{watch("maxGuestsPerRegistration")} per registration</span></div>}
          {watch("recurrencePattern") && <div className="flex justify-between"><span className="text-muted-foreground">Recurrence</span><span>{watch("recurrencePattern")} &times; {watch("recurrenceCount") || "1"}</span></div>}
          {addons.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Add-ons</span><span>{addons.length} items</span></div>}
          {watch("enableDynamicPricing") && <div className="flex justify-between"><span className="text-muted-foreground">Dynamic Pricing</span><span>Enabled</span></div>}
        </div>
      </Card>

      {!watch("title") && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Event title is required</div>}
      {!watch("startDate") && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Start date is required</div>}
      {ticketTypes.some((t) => !t.name) && <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">Some ticket types are missing names</div>}
    </div>
  )
}
