"use client"

import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { FIELD_TYPES, type FormStepProps } from "./shared"

export function Step4Form({ customFields, addCustomField, removeCustomField, updateCustomField }: FormStepProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Default Fields</h3>
        <p className="text-xs text-muted-foreground">Name and Email are always collected.</p>
        <div className="space-y-2">
          {["Name (always required)", "Email (always required)", "Phone", "Organization/Institution", "Department"].map((field) => (
            <div key={field} className="flex items-center justify-between py-1">
              <span className="text-sm">{field}</span>
              {field.includes("always") ? <Badge variant="secondary">Required</Badge> : <Switch />}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Custom Fields</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {FIELD_TYPES.map((ft) => (
            <Button key={ft.value} type="button" variant="outline" size="sm" onClick={() => addCustomField(ft.value)} className="gap-1">
              <Plus className="h-3 w-3" /> {ft.label}
            </Button>
          ))}
        </div>
        {customFields.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No custom fields. Click a field type above to add one.</p>
        )}
        {customFields.map((field, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{FIELD_TYPES.find((f) => f.value === field.fieldType)?.label || field.fieldType}</Badge>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCustomField(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label className="text-xs">Label *</Label><Input placeholder="Field label" value={field.label} onChange={(e) => updateCustomField(i, "label", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Placeholder</Label><Input placeholder="Placeholder text" value={field.placeholder || ""} onChange={(e) => updateCustomField(i, "placeholder", e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Help Text</Label><Input placeholder="Additional info" value={field.helpText || ""} onChange={(e) => updateCustomField(i, "helpText", e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={field.isRequired} onCheckedChange={(v) => updateCustomField(i, "isRequired", !!v)} /><Label className="text-xs">Required</Label></div>
            {["SELECT", "MULTI_SELECT", "RADIO"].includes(field.fieldType) && (
              <div className="space-y-1">
                <Label className="text-xs">Options (one per line)</Label>
                <Textarea rows={3} value={(field.options || []).join("\n")} onChange={(e) => updateCustomField(i, "options", e.target.value.split("\n").filter(Boolean))} placeholder={"Option 1\nOption 2\nOption 3"} />
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}
