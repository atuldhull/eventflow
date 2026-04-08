"use client"

import { TextFieldEditor } from "./TextFieldEditor"
import { TextareaFieldEditor } from "./TextareaFieldEditor"
import { ImageFieldEditor } from "./ImageFieldEditor"
import { UrlFieldEditor } from "./UrlFieldEditor"
import { ColorFieldEditor } from "./ColorFieldEditor"
import { SelectFieldEditor } from "./SelectFieldEditor"
import { ToggleFieldEditor } from "./ToggleFieldEditor"
import { NumberFieldEditor } from "./NumberFieldEditor"
import { SliderFieldEditor } from "./SliderFieldEditor"
import { CTAButtonsEditor } from "./CTAButtonsEditor"
import { StatsListEditor } from "./StatsListEditor"
import { CardListEditor } from "./CardListEditor"
import { TeamListEditor } from "./TeamListEditor"
import { TestimonialListEditor } from "./TestimonialListEditor"
import { ImageListEditor } from "./ImageListEditor"
import { FAQListEditor } from "./FAQListEditor"
import { SponsorListEditor } from "./SponsorListEditor"

interface FieldRendererProps {
  fieldKey: string
  fieldDef: { type: string; label: string; placeholder?: string; required?: boolean; max?: number; options?: string[]; min?: number; default?: any; description?: string }
  value: any
  onChange: (value: any) => void
}

export function FieldRenderer({ fieldKey, fieldDef, value, onChange }: FieldRendererProps) {
  const commonProps = { label: fieldDef.label, required: fieldDef.required, description: fieldDef.description }

  switch (fieldDef.type) {
    case "text":
      return <TextFieldEditor {...commonProps} value={value || ""} onChange={onChange} placeholder={fieldDef.placeholder} />
    case "textarea":
    case "richtext":
      return <TextareaFieldEditor {...commonProps} value={value || ""} onChange={onChange} placeholder={fieldDef.placeholder} />
    case "image":
      return <ImageFieldEditor {...commonProps} value={value || ""} onChange={onChange} />
    case "url":
      return <UrlFieldEditor {...commonProps} value={value || ""} onChange={onChange} placeholder={fieldDef.placeholder} />
    case "color":
      return <ColorFieldEditor {...commonProps} value={value || "#000000"} onChange={onChange} />
    case "select":
      return <SelectFieldEditor {...commonProps} value={value ?? fieldDef.default} onChange={onChange} options={fieldDef.options || []} />
    case "boolean":
      return <ToggleFieldEditor {...commonProps} value={value ?? fieldDef.default ?? false} onChange={onChange} />
    case "number":
      return <NumberFieldEditor {...commonProps} value={value ?? fieldDef.default ?? 0} onChange={onChange} min={fieldDef.min} max={fieldDef.max} />
    case "slider":
      return <SliderFieldEditor {...commonProps} value={value ?? fieldDef.default ?? 0} onChange={onChange} min={fieldDef.min || 0} max={fieldDef.max || 100} />
    case "cta-buttons":
      return <CTAButtonsEditor {...commonProps} value={value || []} onChange={onChange} max={fieldDef.max || 3} />
    case "stats-list":
      return <StatsListEditor {...commonProps} value={value || []} onChange={onChange} />
    case "card-list":
      return <CardListEditor {...commonProps} value={value || []} onChange={onChange} max={fieldDef.max} />
    case "team-list":
      return <TeamListEditor {...commonProps} value={value || []} onChange={onChange} />
    case "testimonial-list":
      return <TestimonialListEditor {...commonProps} value={value || []} onChange={onChange} />
    case "image-list":
      return <ImageListEditor {...commonProps} value={value || []} onChange={onChange} />
    case "faq-list":
      return <FAQListEditor {...commonProps} value={value || []} onChange={onChange} />
    case "sponsor-list":
      return <SponsorListEditor {...commonProps} value={value || []} onChange={onChange} />
    default:
      return <TextFieldEditor {...commonProps} value={String(value || "")} onChange={onChange} placeholder={fieldDef.placeholder} />
  }
}
