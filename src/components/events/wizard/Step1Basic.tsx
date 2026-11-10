"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { EVENT_TYPES, CATEGORIES, VISIBILITIES, type StepProps } from "./shared"
import { Field, WizardSection } from "./Section"

const label = (v: string) => {
  const w = v.replace(/_/g, " ").toLowerCase()
  return w.charAt(0).toUpperCase() + w.slice(1)
}

export function Step1Basic({ register, watch, setValue, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <WizardSection title="Event details" description="What people see first on the event page and in listings.">
        <Field id="ev-title" label="Event title" required error={errors.title?.message} counter={`${(watch("title") || "").length}/150`}>
          <Input id="ev-title" placeholder="e.g., Tech Summit 2026" aria-invalid={!!errors.title} {...register("title")} />
        </Field>
        <Field
          id="ev-slug"
          label="Event URL"
          required
          error={errors.slug?.message}
          hint={
            <>
              This is the web address of your event page. Use lowercase letters, numbers, and hyphens only.
              Example: <span className="font-mono">events/tech-summit-2026</span>
            </>
          }
        >
          <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <span className="flex shrink-0 items-center border-r border-input bg-raised px-3 font-mono text-[13px] text-muted-foreground select-none">events/</span>
            <Input
              id="ev-slug"
              placeholder="tech-summit-2026"
              aria-invalid={!!errors.slug}
              className="rounded-none border-0 font-mono text-[13px] focus-visible:ring-0 md:text-[13px]"
              {...register("slug")}
            />
          </div>
        </Field>
        <Field id="ev-short" label="Short description" required error={errors.shortDescription?.message} counter={`${(watch("shortDescription") || "").length}/200`}>
          <Textarea id="ev-short" placeholder="A brief one-liner..." rows={2} aria-invalid={!!errors.shortDescription} {...register("shortDescription")} />
        </Field>
        <Field id="ev-desc" label="Full description" required error={errors.description?.message} counter={`${(watch("description") || "").length}/5000`}>
          <Textarea id="ev-desc" placeholder="Detailed description of your event..." rows={6} aria-invalid={!!errors.description} {...register("description")} />
        </Field>
      </WizardSection>

      <WizardSection title="Classification" description="Shapes the schedule options and where the event is listed.">
        <div className="space-y-1.5">
          <Label id="ev-type-label">Event type<span className="text-faint" aria-hidden> *</span></Label>
          <div role="radiogroup" aria-labelledby="ev-type-label" className="grid gap-2 sm:grid-cols-2">
            {EVENT_TYPES.map((t) => {
              const on = watch("type") === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setValue("type", t.value)}
                  className={cn(
                    "press flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    on ? "border-brand bg-brand/[0.06] ring-1 ring-brand" : "border-border hover:border-input hover:bg-muted/50",
                  )}
                >
                  <t.icon className={cn("mt-0.5 size-4 shrink-0", on ? "text-brand" : "text-muted-foreground")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-[13px] text-muted-foreground">{t.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {errors.type && <p className="text-xs text-destructive" role="alert">{errors.type.message}</p>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ev-category" label="Category" required error={errors.category?.message}>
            <Select items={CATEGORIES.map((c) => ({ value: c, label: label(c) }))} value={watch("category")} onValueChange={(v) => setValue("category", v || "")}>
              <SelectTrigger id="ev-category" className="w-full" aria-invalid={!!errors.category}><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{label(c)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="ev-visibility" label="Visibility" required hint={VISIBILITIES.find((v) => v.value === watch("visibility"))?.description}>
            <Select items={VISIBILITIES} value={watch("visibility")} onValueChange={(v) => setValue("visibility", v || "PUBLIC")}>
              <SelectTrigger id="ev-visibility" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{VISIBILITIES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </WizardSection>
    </div>
  )
}
