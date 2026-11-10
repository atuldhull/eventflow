"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { DEFAULT_EVENT_TIME_ZONE, supportedTimeZones, viewerTimeZone, zoneDiffersFromViewer } from "@/lib/event-time"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { StepProps } from "./shared"
import { Field, ToggleRow, WizardSection } from "./Section"

const PLATFORMS = [
  { value: "ZOOM", label: "Zoom" },
  { value: "GOOGLE_MEET", label: "Google Meet" },
  { value: "TEAMS", label: "Microsoft Teams" },
  { value: "YOUTUBE", label: "YouTube Live" },
  { value: "CUSTOM", label: "Custom" },
]

const PATTERNS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 Weeks" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
]

export function Step2DateVenue({ register, watch, setValue, errors }: StepProps) {
  const isOnline = watch("isOnline")
  const eventType = watch("type")
  const timezone = watch("timezone") || DEFAULT_EVENT_TIME_ZONE
  const zones = useMemo(() => supportedTimeZones(timezone), [timezone])
  const startDate = watch("startDate")

  return (
    <div className="space-y-6">
      <WizardSection title="Schedule" description={`Enter times as the clock reads in ${timezone}. Attendees see them in this time zone.`}>
        <Field id="ev-tz" label="Time zone" hint={zoneDiffersFromViewer(timezone) ? `Not your device's time zone (${viewerTimeZone() ?? "unknown"}).` : undefined}>
          <select
            id="ev-tz"
            value={timezone}
            onChange={(e) => setValue("timezone", e.target.value, { shouldDirty: true })}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11 sm:max-w-sm dark:bg-input/30"
          >
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ev-start" label="Start date & time" required error={errors.startDate?.message}>
            <Input id="ev-start" type="datetime-local" aria-invalid={!!errors.startDate} {...register("startDate")} />
          </Field>
          <Field id="ev-end" label="End date & time" required error={errors.endDate?.message}>
            <Input id="ev-end" type="datetime-local" min={startDate || undefined} aria-invalid={!!errors.endDate} {...register("endDate")} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ev-reg-open" label="Registration opens" error={errors.registrationStartDate?.message}>
            <Input id="ev-reg-open" type="datetime-local" aria-invalid={!!errors.registrationStartDate} {...register("registrationStartDate")} />
          </Field>
          <Field id="ev-reg-close" label="Registration closes" hint="By the time the event ends, at the latest." error={errors.registrationEndDate?.message}>
            <Input id="ev-reg-close" type="datetime-local" max={watch("endDate") || undefined} aria-invalid={!!errors.registrationEndDate} {...register("registrationEndDate")} />
          </Field>
        </div>
      </WizardSection>

      <WizardSection title="Venue" description="Where attendees go, or the link they join.">
        <ToggleRow
          label="Online event"
          description="This is a virtual event"
          checked={watch("isOnline")}
          onCheckedChange={(v) => setValue("isOnline", !!v)}
        />
        {/* A hybrid event has both a venue and an online part. */}
        {(!isOnline || eventType === "HYBRID") && (
          <>
            <Field id="ev-venue" label="Venue name">
              <Input id="ev-venue" placeholder="e.g., Auditorium Hall" {...register("venue")} />
            </Field>
            <Field id="ev-address" label="Address">
              <Textarea id="ev-address" placeholder="Full address..." rows={2} {...register("venueAddress")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="ev-city" label="City"><Input id="ev-city" placeholder="City" {...register("venueCity")} /></Field>
              <Field id="ev-state" label="State"><Input id="ev-state" placeholder="State" {...register("venueState")} /></Field>
              <Field id="ev-country" label="Country"><Input id="ev-country" placeholder="India" {...register("venueCountry")} /></Field>
            </div>
          </>
        )}
        {(isOnline || eventType === "HYBRID") && (
          <>
            <Field id="ev-platform" label="Platform">
              <Select items={PLATFORMS} value={watch("onlinePlatform") || ""} onValueChange={(v) => setValue("onlinePlatform", v || "")}>
                <SelectTrigger id="ev-platform" className="w-full"><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="ev-link" label="Meeting link">
              <Input id="ev-link" placeholder="https://..." {...register("onlineLink")} />
            </Field>
          </>
        )}
      </WizardSection>

      {eventType === "RECURRING" && (
        <WizardSection
          title="Recurrence"
          description="Each occurrence will be created as a separate event linked to a parent. Dates will be auto-calculated from the start date."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="ev-pattern" label="Repeat pattern">
              <Select items={PATTERNS} value={watch("recurrencePattern") || ""} onValueChange={(v) => setValue("recurrencePattern", v || "")}>
                <SelectTrigger id="ev-pattern" className="w-full"><SelectValue placeholder="Select pattern" /></SelectTrigger>
                <SelectContent>
                  {PATTERNS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="ev-occurrences" label="Number of occurrences" hint="How many times this event repeats">
              <Input id="ev-occurrences" type="number" min={2} max={52} placeholder="e.g., 6" {...register("recurrenceCount")} />
            </Field>
          </div>
        </WizardSection>
      )}
    </div>
  )
}
