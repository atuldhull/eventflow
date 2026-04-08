"use client"

import { Label } from "@/components/ui/label"

interface Props { label: string; value: number; onChange: (v: number) => void; min: number; max: number; required?: boolean; description?: string }

export function SliderFieldEditor({ label, value, onChange, min, max, description }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
    </div>
  )
}
