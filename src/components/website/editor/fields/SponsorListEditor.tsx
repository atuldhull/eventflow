"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface Sponsor { name: string; logo: string; website?: string; tier: string }
interface Props { label: string; value: Sponsor[]; onChange: (v: Sponsor[]) => void; required?: boolean; description?: string }

const TIERS = ["TITLE", "PLATINUM", "GOLD", "SILVER", "BRONZE", "PARTNER", "MEDIA"]

export function SponsorListEditor({ label, value, onChange, description }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const update = (idx: number, field: string, val: string) => onChange(value.map((s, i) => i === idx ? { ...s, [field]: val } : s))
  const add = () => { onChange([...value, { name: "", logo: "", tier: "GOLD" }]); setExpanded(value.length) }
  const remove = (idx: number) => { onChange(value.filter((_, i) => i !== idx)); if (expanded === idx) setExpanded(null) }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value.map((sponsor, idx) => (
        <div key={idx} className="border rounded-lg overflow-hidden">
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50" onClick={() => setExpanded(expanded === idx ? null : idx)}>
            <span>{sponsor.name || `Sponsor ${idx + 1}`} ({sponsor.tier})</span>
            <div className="flex items-center gap-1">
              <Trash2 className="h-3 w-3 text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); remove(idx) }} />
              {expanded === idx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </div>
          </button>
          {expanded === idx && (
            <div className="px-3 pb-3 space-y-2 border-t">
              <Input value={sponsor.name} onChange={(e) => update(idx, "name", e.target.value)} placeholder="Sponsor name" className="text-xs h-7 mt-2" />
              <Input value={sponsor.logo} onChange={(e) => update(idx, "logo", e.target.value)} placeholder="Logo URL" className="text-xs h-7" />
              <Input value={sponsor.website || ""} onChange={(e) => update(idx, "website", e.target.value)} placeholder="Website URL" className="text-xs h-7" />
              <select value={sponsor.tier} onChange={(e) => update(idx, "tier", e.target.value)} className="h-7 w-full rounded border bg-transparent px-2 text-xs">
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add Sponsor</Button>
    </div>
  )
}
