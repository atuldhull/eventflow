"use client"

import { useId } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Props { label: string; value: boolean; onChange: (v: boolean) => void; required?: boolean; description?: string }

export function ToggleFieldEditor({ label, value, onChange, description }: Props) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
        {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={!!value} onCheckedChange={() => onChange(!value)} />
    </div>
  )
}
