"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { EVENT_TYPES, CATEGORIES, VISIBILITIES, type StepProps } from "./shared"

export function Step1Basic({ register, watch, setValue, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Event Details</h3>
        <div className="space-y-2">
          <Label>Event Title *</Label>
          <Input placeholder="e.g., Tech Summit 2026" {...register("title")} />
          <div className="flex justify-between"><p className="text-xs text-destructive">{errors.title?.message}</p><span className="text-xs text-muted-foreground">{(watch("title") || "").length}/150</span></div>
        </div>
        <div className="space-y-2">
          <Label>Event URL *</Label>
          <Input placeholder="tech-summit-2026" {...register("slug")} />
          <p className="text-xs text-muted-foreground">
            This is the web address of your event page. Use lowercase letters, numbers, and hyphens only.
            Example: <span className="font-mono">events/tech-summit-2026</span>
          </p>
          {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Short Description *</Label>
          <Textarea placeholder="A brief one-liner..." rows={2} {...register("shortDescription")} />
          <div className="flex justify-between"><p className="text-xs text-destructive">{errors.shortDescription?.message}</p><span className="text-xs text-muted-foreground">{(watch("shortDescription") || "").length}/200</span></div>
        </div>
        <div className="space-y-2">
          <Label>Full Description *</Label>
          <Textarea placeholder="Detailed description of your event..." rows={6} {...register("description")} />
          <div className="flex justify-between"><p className="text-xs text-destructive">{errors.description?.message}</p><span className="text-xs text-muted-foreground">{(watch("description") || "").length}/5000</span></div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Classification</h3>
        <div className="space-y-2">
          <Label>Event Type *</Label>
          <div className="grid grid-cols-2 gap-3">
            {EVENT_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setValue("type", t.value)}
                className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition-colors", watch("type") === t.value ? "border-primary bg-primary/5" : "hover:border-primary/50")}
              >
                <t.icon className="h-5 w-5 mt-0.5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
          {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={watch("category")} onValueChange={(v) => setValue("category", v || "")}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Visibility *</Label>
            <Select value={watch("visibility")} onValueChange={(v) => setValue("visibility", v || "PUBLIC")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VISIBILITIES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {VISIBILITIES.find((v) => v.value === watch("visibility"))?.description}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
