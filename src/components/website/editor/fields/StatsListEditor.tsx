"use client"

import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface StatItem { value: string; label: string; suffix?: string }
interface Props { label: string; value: StatItem[]; onChange: (v: StatItem[]) => void; required?: boolean; description?: string }

export function StatsListEditor({ label, value, onChange, description }: Props) {
  const update = (idx: number, field: string, val: string) => onChange(value.map((s, i) => i === idx ? { ...s, [field]: val } : s))
  const add = () => onChange([...value, { value: "0", label: "Label", suffix: "" }])
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value.map((stat, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input value={stat.value} onChange={(e) => update(idx, "value", e.target.value)} placeholder="500" className="text-xs h-7 w-16" />
          <Input value={stat.label} onChange={(e) => update(idx, "label", e.target.value)} placeholder="Members" className="text-xs h-7 flex-1" />
          <Input value={stat.suffix || ""} onChange={(e) => update(idx, "suffix", e.target.value)} placeholder="+" className="text-xs h-7 w-10" />
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0" onClick={() => remove(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add Stat</Button>
    </div>
  )
}
