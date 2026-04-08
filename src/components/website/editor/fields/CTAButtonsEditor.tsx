"use client"

import { Plus, Trash2, GripVertical } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface CTAButton { text: string; href: string; variant: string }
interface Props { label: string; value: CTAButton[]; onChange: (v: CTAButton[]) => void; max: number; required?: boolean; description?: string }

export function CTAButtonsEditor({ label, value, onChange, max, description }: Props) {
  const update = (idx: number, field: string, val: string) => {
    const updated = value.map((b, i) => i === idx ? { ...b, [field]: val } : b)
    onChange(updated)
  }
  const add = () => { if (value.length < max) onChange([...value, { text: "Button", href: "#", variant: "primary" }]) }
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value.map((btn, idx) => (
        <div key={idx} className="flex items-start gap-1.5 p-2 rounded-lg border bg-muted/30">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0 cursor-grab" />
          <div className="flex-1 space-y-1.5">
            <Input value={btn.text} onChange={(e) => update(idx, "text", e.target.value)} placeholder="Button text" className="text-xs h-7" />
            <Input value={btn.href} onChange={(e) => update(idx, "href", e.target.value)} placeholder="/register or #section" className="text-xs h-7" />
            <select value={btn.variant} onChange={(e) => update(idx, "variant", e.target.value)} className="h-7 w-full rounded border bg-transparent px-2 text-xs">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="outline">Outline</option>
              <option value="ghost">Ghost</option>
            </select>
          </div>
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0" onClick={() => remove(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </div>
      ))}
      {value.length < max && <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add Button</Button>}
    </div>
  )
}
