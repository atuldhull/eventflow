"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface FAQItem { question: string; answer: string }
interface Props { label: string; value: FAQItem[]; onChange: (v: FAQItem[]) => void; required?: boolean; description?: string }

export function FAQListEditor({ label, value, onChange, description }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const update = (idx: number, field: string, val: string) => onChange(value.map((f, i) => i === idx ? { ...f, [field]: val } : f))
  const add = () => { onChange([...value, { question: "", answer: "" }]); setExpanded(value.length) }
  const remove = (idx: number) => { onChange(value.filter((_, i) => i !== idx)); if (expanded === idx) setExpanded(null) }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value.map((faq, idx) => (
        <div key={idx} className="border rounded-lg overflow-hidden">
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50" onClick={() => setExpanded(expanded === idx ? null : idx)}>
            <span className="truncate mr-2">{faq.question || `FAQ ${idx + 1}`}</span>
            <div className="flex items-center gap-1 shrink-0">
              <Trash2 className="h-3 w-3 text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); remove(idx) }} />
              {expanded === idx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </div>
          </button>
          {expanded === idx && (
            <div className="px-3 pb-3 space-y-2 border-t">
              <Input value={faq.question} onChange={(e) => update(idx, "question", e.target.value)} placeholder="Question" className="text-xs h-7 mt-2" />
              <Textarea value={faq.answer} onChange={(e) => update(idx, "answer", e.target.value)} placeholder="Answer" rows={3} className="text-xs" />
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add FAQ</Button>
    </div>
  )
}
