"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight, Star } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface Testimonial { quote: string; name: string; role?: string; avatar?: string; rating?: number }
interface Props { label: string; value: Testimonial[]; onChange: (v: Testimonial[]) => void; required?: boolean; description?: string }

export function TestimonialListEditor({ label, value, onChange, description }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const update = (idx: number, field: string, val: any) => onChange(value.map((t, i) => i === idx ? { ...t, [field]: val } : t))
  const add = () => { onChange([...value, { quote: "", name: "", role: "", rating: 5 }]); setExpanded(value.length) }
  const remove = (idx: number) => { onChange(value.filter((_, i) => i !== idx)); if (expanded === idx) setExpanded(null) }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value.map((t, idx) => (
        <div key={idx} className="border rounded-lg overflow-hidden">
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50" onClick={() => setExpanded(expanded === idx ? null : idx)}>
            <span>{t.name || `Testimonial ${idx + 1}`}</span>
            <div className="flex items-center gap-1">
              <Trash2 className="h-3 w-3 text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); remove(idx) }} />
              {expanded === idx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </div>
          </button>
          {expanded === idx && (
            <div className="px-3 pb-3 space-y-2 border-t">
              <Textarea value={t.quote} onChange={(e) => update(idx, "quote", e.target.value)} placeholder="Testimonial quote" rows={3} className="text-xs mt-2" />
              <Input value={t.name} onChange={(e) => update(idx, "name", e.target.value)} placeholder="Name" className="text-xs h-7" />
              <Input value={t.role || ""} onChange={(e) => update(idx, "role", e.target.value)} placeholder="Role / Company" className="text-xs h-7" />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Rating:</span>
                {[1, 2, 3, 4, 5].map((r) => (
                  <button key={r} onClick={() => update(idx, "rating", r)} className="p-0">
                    <Star className={`h-4 w-4 ${r <= (t.rating || 0) ? "fill-chart-3 text-chart-3" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add Testimonial</Button>
    </div>
  )
}
