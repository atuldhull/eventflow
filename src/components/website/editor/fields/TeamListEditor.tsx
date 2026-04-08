"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface Member { name: string; role: string; avatar?: string; bio?: string; linkedin?: string; twitter?: string; email?: string }
interface Props { label: string; value: Member[]; onChange: (v: Member[]) => void; required?: boolean; description?: string }

export function TeamListEditor({ label, value, onChange, description }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const update = (idx: number, field: string, val: string) => onChange(value.map((m, i) => i === idx ? { ...m, [field]: val } : m))
  const add = () => { onChange([...value, { name: "", role: "" }]); setExpanded(value.length) }
  const remove = (idx: number) => { onChange(value.filter((_, i) => i !== idx)); if (expanded === idx) setExpanded(null) }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value.map((member, idx) => (
        <div key={idx} className="border rounded-lg overflow-hidden">
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50" onClick={() => setExpanded(expanded === idx ? null : idx)}>
            <span>{member.name || `Member ${idx + 1}`}</span>
            <div className="flex items-center gap-1">
              <Trash2 className="h-3 w-3 text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); remove(idx) }} />
              {expanded === idx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </div>
          </button>
          {expanded === idx && (
            <div className="px-3 pb-3 space-y-2 border-t mt-0">
              <Input value={member.name} onChange={(e) => update(idx, "name", e.target.value)} placeholder="Full name" className="text-xs h-7 mt-2" />
              <Input value={member.role} onChange={(e) => update(idx, "role", e.target.value)} placeholder="Role / Title" className="text-xs h-7" />
              <Input value={member.avatar || ""} onChange={(e) => update(idx, "avatar", e.target.value)} placeholder="Avatar URL" className="text-xs h-7" />
              <Textarea value={member.bio || ""} onChange={(e) => update(idx, "bio", e.target.value)} placeholder="Short bio" rows={2} className="text-xs" />
              <Input value={member.linkedin || ""} onChange={(e) => update(idx, "linkedin", e.target.value)} placeholder="LinkedIn URL" className="text-xs h-7" />
              <Input value={member.email || ""} onChange={(e) => update(idx, "email", e.target.value)} placeholder="Email" className="text-xs h-7" />
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add Member</Button>
    </div>
  )
}
