"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface CardItem { icon?: string; title: string; description: string }
interface Props { label: string; value: CardItem[]; onChange: (v: CardItem[]) => void; max?: number; required?: boolean; description?: string }

export function CardListEditor({ label, value, onChange, max, description }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const update = (idx: number, field: string, val: string) => onChange(value.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  const add = () => { if (!max || value.length < max) { onChange([...value, { icon: "Star", title: "", description: "" }]); setExpanded(value.length) } }
  const remove = (idx: number) => { onChange(value.filter((_, i) => i !== idx)); if (expanded === idx) setExpanded(null) }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value.map((card, idx) => (
        <div key={idx} className="border rounded-lg overflow-hidden">
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50" onClick={() => setExpanded(expanded === idx ? null : idx)}>
            <span>{card.title || `Card ${idx + 1}`}</span>
            <div className="flex items-center gap-1">
              <Trash2 className="h-3 w-3 text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); remove(idx) }} />
              {expanded === idx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </div>
          </button>
          {expanded === idx && (
            <div className="px-3 pb-3 space-y-2 border-t">
              <Input value={card.icon || ""} onChange={(e) => update(idx, "icon", e.target.value)} placeholder="Icon name (e.g., Star)" className="text-xs h-7 mt-2" />
              <Input value={card.title} onChange={(e) => update(idx, "title", e.target.value)} placeholder="Title" className="text-xs h-7" />
              <Textarea value={card.description} onChange={(e) => update(idx, "description", e.target.value)} placeholder="Description" rows={2} className="text-xs" />
            </div>
          )}
        </div>
      ))}
      {(!max || value.length < max) && <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add Card</Button>}
    </div>
  )
}
