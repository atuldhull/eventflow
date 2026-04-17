"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { StepProps } from "./shared"

export function Step2DateVenue({ register, watch, setValue, errors }: StepProps) {
  const isOnline = watch("isOnline")
  const eventType = watch("type")

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Event Schedule</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start Date & Time *</Label>
            <Input type="datetime-local" {...register("startDate")} />
            {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>End Date & Time *</Label>
            <Input type="datetime-local" {...register("endDate")} />
            {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Registration Opens</Label>
            <Input type="datetime-local" {...register("registrationStartDate")} />
          </div>
          <div className="space-y-2">
            <Label>Registration Closes</Label>
            <Input type="datetime-local" {...register("registrationEndDate")} />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Venue</h3>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium">Online Event</p><p className="text-xs text-muted-foreground">This is a virtual event</p></div>
          <Switch checked={watch("isOnline")} onCheckedChange={(v) => setValue("isOnline", !!v)} />
        </div>
        {!isOnline && (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Venue Name</Label><Input placeholder="e.g., Auditorium Hall" {...register("venue")} /></div>
            <div className="space-y-2"><Label>Address</Label><Textarea placeholder="Full address..." rows={2} {...register("venueAddress")} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>City</Label><Input placeholder="City" {...register("venueCity")} /></div>
              <div className="space-y-2"><Label>State</Label><Input placeholder="State" {...register("venueState")} /></div>
              <div className="space-y-2"><Label>Country</Label><Input placeholder="India" {...register("venueCountry")} /></div>
            </div>
          </div>
        )}
        {isOnline && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={watch("onlinePlatform") || ""} onValueChange={(v) => setValue("onlinePlatform", v || "")}>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZOOM">Zoom</SelectItem>
                  <SelectItem value="GOOGLE_MEET">Google Meet</SelectItem>
                  <SelectItem value="TEAMS">Microsoft Teams</SelectItem>
                  <SelectItem value="YOUTUBE">YouTube Live</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Meeting Link</Label><Input placeholder="https://..." {...register("onlineLink")} /></div>
          </div>
        )}
      </Card>

      {eventType === "RECURRING" && (
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-medium">Recurrence Settings</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Repeat Pattern</Label>
              <Select value={watch("recurrencePattern") || ""} onValueChange={(v) => setValue("recurrencePattern", v || "")}>
                <SelectTrigger><SelectValue placeholder="Select pattern" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="BIWEEKLY">Every 2 Weeks</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Occurrences</Label>
              <Input type="number" min={2} max={52} placeholder="e.g., 6" {...register("recurrenceCount")} />
              <p className="text-xs text-muted-foreground">How many times this event repeats</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Each occurrence will be created as a separate event linked to a parent. Dates will be auto-calculated from the start date.</p>
        </Card>
      )}
    </div>
  )
}
