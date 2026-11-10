"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/** Settings-style block: the title and a line of help on the left, the fields on the right. */
export function WizardSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("grid gap-4 border-t border-rule pt-6 first:border-t-0 first:pt-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10", className)}>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  )
}

/** Label, control, then a hint or an error under it. */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  counter,
  children,
  className,
}: {
  id?: string
  label: string
  required?: boolean
  hint?: React.ReactNode
  error?: string
  counter?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-faint" aria-hidden> *</span>}
      </Label>
      {children}
      {(hint || error || counter) && (
        <div className="flex items-start justify-between gap-3 text-xs">
          <div className="min-w-0">
            {error ? <p className="text-destructive" role="alert">{error}</p> : hint ? <p className="text-muted-foreground">{hint}</p> : null}
          </div>
          {counter && <span className="shrink-0 text-faint tabular-nums">{counter}</span>}
        </div>
      )}
    </div>
  )
}

/** A switch with its label and one line of help, as one row. */
export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  className,
}: {
  label: string
  description?: string
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <Switch
        aria-label={label}
        {...(checked !== undefined ? { checked } : {})}
        {...(onCheckedChange ? { onCheckedChange: (v: boolean) => onCheckedChange(!!v) } : {})}
      />
    </div>
  )
}
