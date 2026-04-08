"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Minus, Plus } from "lucide-react"

interface Props { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; required?: boolean; description?: string }

export function NumberFieldEditor({ label, value, onChange, min, max, required, description }: Props) {
  const adjust = (delta: number) => {
    const next = value + delta
    if (min !== undefined && next < min) return
    if (max !== undefined && next > max) return
    onChange(next)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" className="h-8 w-8 shrink-0" onClick={() => adjust(-1)}><Minus className="h-3 w-3" /></Button>
        <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} className="text-sm h-8 text-center w-20" />
        <Button variant="outline" size="icon-sm" className="h-8 w-8 shrink-0" onClick={() => adjust(1)}><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
  )
}
