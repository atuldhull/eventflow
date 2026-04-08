"use client"

import { Label } from "@/components/ui/label"

interface Props { label: string; value: boolean; onChange: (v: boolean) => void; required?: boolean; description?: string }

export function ToggleFieldEditor({ label, value, onChange, description }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <Label className="text-xs font-medium">{label}</Label>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${value ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
      </button>
    </div>
  )
}
