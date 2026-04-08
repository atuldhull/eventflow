"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LinkIcon } from "lucide-react"

interface Props { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; description?: string }

export function UrlFieldEditor({ label, value, onChange, placeholder, required, description }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <div className="relative">
        <LinkIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "https://..."} className="text-sm h-9 pl-8" />
      </div>
    </div>
  )
}
