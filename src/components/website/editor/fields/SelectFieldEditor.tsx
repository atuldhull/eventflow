"use client"

import { Label } from "@/components/ui/label"

interface Props { label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean; description?: string }

export function SelectFieldEditor({ label, value, onChange, options, required, description }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
        {options.map((opt) => <option key={opt} value={opt}>{opt.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>)}
      </select>
    </div>
  )
}
