"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { UseFormReturn } from "react-hook-form"

interface FormField {
  id: string
  label: string
  fieldType: string
  placeholder?: string | null
  helpText?: string | null
  isRequired: boolean
  options: string[]
}

interface RegistrationFormProps {
  fields: FormField[]
  form: UseFormReturn<any>
}

export function RegistrationForm({ fields, form }: RegistrationFormProps) {
  const { register, setValue, watch, formState: { errors } } = form

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const fieldName = `customFields.${field.label}`
        const error = errors?.customFields?.[field.label as keyof typeof errors.customFields]

        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.isRequired && <span className="text-destructive ml-0.5">*</span>}
            </Label>

            {field.fieldType === "TEXT" && (
              <Input id={field.id} placeholder={field.placeholder || ""} {...register(fieldName)} />
            )}

            {field.fieldType === "TEXTAREA" && (
              <Textarea id={field.id} placeholder={field.placeholder || ""} rows={3} {...register(fieldName)} />
            )}

            {field.fieldType === "EMAIL" && (
              <Input id={field.id} type="email" placeholder={field.placeholder || ""} {...register(fieldName)} />
            )}

            {field.fieldType === "PHONE" && (
              <Input id={field.id} type="tel" placeholder={field.placeholder || "+91 9876543210"} {...register(fieldName)} />
            )}

            {field.fieldType === "NUMBER" && (
              <Input id={field.id} type="number" placeholder={field.placeholder || ""} {...register(fieldName)} />
            )}

            {field.fieldType === "DATE" && (
              <Input id={field.id} type="date" {...register(fieldName)} />
            )}

            {field.fieldType === "URL" && (
              <Input id={field.id} type="url" placeholder={field.placeholder || "https://..."} {...register(fieldName)} />
            )}

            {(field.fieldType === "SELECT" || field.fieldType === "RADIO") && (
              <Select value={watch(fieldName) || ""} onValueChange={(v) => setValue(fieldName, v || "")}>
                <SelectTrigger><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.fieldType === "CHECKBOX" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={field.id}
                  checked={watch(fieldName) || false}
                  onCheckedChange={(v) => setValue(fieldName, !!v)}
                />
                <label htmlFor={field.id} className="text-sm cursor-pointer">{field.placeholder || field.label}</label>
              </div>
            )}

            {field.fieldType === "FILE_UPLOAD" && (
              <Input id={field.id} type="file" {...register(fieldName)} />
            )}

            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-destructive">{(error as any)?.message}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
