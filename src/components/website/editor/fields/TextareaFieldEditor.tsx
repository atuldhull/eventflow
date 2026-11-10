"use client"

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface Props { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; description?: string }

export function TextareaFieldEditor({ label, value, onChange, placeholder, required, description }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="text-sm" />
    </div>
  )
}
