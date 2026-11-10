"use client"

import { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Pill } from "@/components/ui/pill"
import { FIELD_TYPES, type FormStepProps } from "./shared"
import { Field, WizardSection } from "./Section"

// The optional default fields; saved to the event's settings.registrationFields and read
// by the public registration form.
const OPTIONAL_FIELDS = [
  { key: "collectPhone", label: "Phone" },
  { key: "collectOrganization", label: "Organization / institution" },
  { key: "collectDepartment", label: "Department" },
] as const

/**
 * The choices of a dropdown / multi-select / radio question. Type one and press Enter (or
 * Add) to add it; pasting several lines adds each. The old textarea dropped the new line
 * on every keystroke (empty lines were filtered out), so Enter did nothing.
 */
function OptionsEditor({ id, options, onChange }: { id: string; options: string[]; onChange: (options: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const add = (text: string) => {
    const incoming = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    const next = [...options]
    for (const o of incoming) if (!next.includes(o)) next.push(o)
    if (next.length !== options.length) onChange(next)
    setDraft("")
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Options</Label>
      {options.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Options">
          {options.map((o, j) => (
            <li key={`${o}-${j}`} className="flex items-center gap-1 rounded-md border bg-raised py-0.5 pr-0.5 pl-2 text-sm">
              <span className="max-w-[16rem] truncate">{o}</span>
              <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" aria-label={`Remove option ${o}`} onClick={() => onChange(options.filter((_, k) => k !== j))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          placeholder={options.length ? "Add another option" : "Type an option and press Enter"}
          onChange={(e) => setDraft(e.target.value)}
          // Typed but not added yet (no Enter): keep it instead of losing it on Next
          onBlur={() => { if (draft.trim()) add(draft) }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add(draft)
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text")
            if (/\r?\n/.test(text)) {
              e.preventDefault()
              add(text)
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => add(draft)} disabled={!draft.trim()}>
          <Plus /> Add
        </Button>
      </div>
      {options.length === 0 && <p className="text-xs text-muted-foreground">Add at least one option for people to choose from.</p>}
    </div>
  )
}

export function Step4Form({ watch, setValue, customFields, addCustomField, removeCustomField, updateCustomField }: FormStepProps) {
  return (
    <div className="space-y-6">
      <WizardSection title="Default fields" description="Name and email are always collected. Turn on the others you want to ask for.">
        <ul className="divide-y divide-rule rounded-lg border px-4">
          {["Name", "Email"].map((field) => (
            <li key={field} className="flex min-h-12 items-center justify-between gap-4 py-2">
              <span className="text-sm">{field}</span>
              <Pill tone="neutral">Always asked</Pill>
            </li>
          ))}
          {OPTIONAL_FIELDS.map((f) => (
            <li key={f.key} className="flex min-h-12 items-center justify-between gap-4 py-2">
              <Label htmlFor={`ev-${f.key}`} className="font-normal">{f.label}</Label>
              <Switch
                id={`ev-${f.key}`}
                checked={!!watch(f.key)}
                onCheckedChange={(v) => setValue(f.key, !!v, { shouldDirty: true })}
                aria-label={`Ask for ${f.label.toLowerCase()}`}
              />
            </li>
          ))}
        </ul>
      </WizardSection>

      <WizardSection title="Custom fields" description="Pick a field type to add a question to the registration form.">
        <div className="flex flex-wrap gap-2">
          {FIELD_TYPES.map((ft) => (
            <Button key={ft.value} type="button" variant="outline" size="sm" onClick={() => addCustomField(ft.value)}>
              <Plus /> {ft.label}
            </Button>
          ))}
        </div>
        {customFields.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No custom fields. Click a field type above to add one.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-lg border">
            {customFields.map((field, i) => (
              <li key={i} className="space-y-4 px-4 py-4">
                <div className="flex items-center justify-between">
                  <Pill tone="neutral">{FIELD_TYPES.find((f) => f.value === field.fieldType)?.label || field.fieldType}</Pill>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Remove field ${i + 1}`} onClick={() => removeCustomField(i)}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`cf-label-${i}`} label="Label" required>
                    <Input id={`cf-label-${i}`} placeholder="Field label" value={field.label} onChange={(e) => updateCustomField(i, "label", e.target.value)} />
                  </Field>
                  <Field id={`cf-ph-${i}`} label="Placeholder">
                    <Input id={`cf-ph-${i}`} placeholder="Placeholder text" value={field.placeholder || ""} onChange={(e) => updateCustomField(i, "placeholder", e.target.value)} />
                  </Field>
                </div>
                <Field id={`cf-help-${i}`} label="Help text">
                  <Input id={`cf-help-${i}`} placeholder="Additional info" value={field.helpText || ""} onChange={(e) => updateCustomField(i, "helpText", e.target.value)} />
                </Field>
                <div className="flex items-center gap-2.5">
                  <Switch id={`cf-req-${i}`} checked={field.isRequired} onCheckedChange={(v) => updateCustomField(i, "isRequired", !!v)} aria-label="Required" />
                  <Label htmlFor={`cf-req-${i}`} className="font-normal">Required</Label>
                </div>
                {["SELECT", "MULTI_SELECT", "RADIO"].includes(field.fieldType) && (
                  <OptionsEditor id={`cf-opts-${i}`} options={field.options || []} onChange={(options) => updateCustomField(i, "options", options)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </WizardSection>
    </div>
  )
}
