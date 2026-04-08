"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; description?: string }

export function TextFieldEditor({ label, value, onChange, placeholder, required, description }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm h-9" />
    </div>
  )
}
