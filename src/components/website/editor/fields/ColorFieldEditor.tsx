"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props { label: string; value: string; onChange: (v: string) => void; required?: boolean; description?: string }

export function ColorFieldEditor({ label, value, onChange, required, description }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-md border cursor-pointer" />
        </div>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="text-sm h-9 w-28 font-mono" />
      </div>
    </div>
  )
}
