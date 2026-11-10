"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Loader2, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { FILE_UPLOADING, isFileUploading, isUploadedFileUrl } from "@/lib/registration-details"

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page's form shape varies; values live under customFields.<field id>
  form: UseFormReturn<any>
  /** messages keyed by field id, from the details step's validation */
  errors?: Record<string, string | undefined>
  /**
   * Whether files can be uploaded: POST /api/upload needs a session, so signed-out (guest)
   * registrants are asked to sign in instead.
   */
  canUpload?: boolean
}

/**
 * The organizer's custom questions. Values are stored under customFields.<field id> (a
 * label can contain dots, which react-hook-form would read as a nested path); the page
 * maps them back to labels when it submits.
 */
export function RegistrationForm({ fields, form, errors = {}, canUpload = true }: RegistrationFormProps) {
  const { register, setValue, watch } = form as UseFormReturn<FieldValues>

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const fieldName = `customFields.${field.id}`
        const error = errors[field.id]
        const describedBy = [field.helpText && `${field.id}-help`, error && `${field.id}-error`].filter(Boolean).join(" ") || undefined
        const a11y = { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": field.isRequired || undefined }
        const isGroup = field.fieldType === "MULTI_SELECT"

        return (
          <div key={field.id} className="space-y-2" role={isGroup ? "group" : undefined} aria-labelledby={isGroup ? `${field.id}-label` : undefined}>
            <Label id={`${field.id}-label`} htmlFor={isGroup ? undefined : field.id}>
              {field.label}
              {field.isRequired && <span className="-ml-1 text-muted-foreground">*</span>}
            </Label>

            {field.fieldType === "TEXT" && (
              <Input id={field.id} placeholder={field.placeholder || ""} {...a11y} {...register(fieldName)} />
            )}

            {field.fieldType === "TEXTAREA" && (
              <Textarea id={field.id} placeholder={field.placeholder || ""} rows={3} {...a11y} {...register(fieldName)} />
            )}

            {field.fieldType === "EMAIL" && (
              <Input id={field.id} type="email" autoComplete="off" placeholder={field.placeholder || ""} {...a11y} {...register(fieldName)} />
            )}

            {field.fieldType === "PHONE" && (
              <Input id={field.id} type="tel" placeholder={field.placeholder || "+91 9876543210"} {...a11y} {...register(fieldName)} />
            )}

            {field.fieldType === "NUMBER" && (
              <Input id={field.id} type="number" inputMode="decimal" placeholder={field.placeholder || ""} {...a11y} {...register(fieldName)} />
            )}

            {field.fieldType === "DATE" && (
              <Input id={field.id} type="date" {...a11y} {...register(fieldName)} />
            )}

            {field.fieldType === "URL" && (
              <Input id={field.id} type="url" placeholder={field.placeholder || "https://..."} {...a11y} {...register(fieldName)} />
            )}

            {(field.fieldType === "SELECT" || field.fieldType === "RADIO") && (
              <Select value={watch(fieldName) || ""} onValueChange={(v) => setValue(fieldName, v || "")}>
                <SelectTrigger id={field.id} className="h-9! w-full pointer-coarse:h-11!" {...a11y}>
                  <SelectValue placeholder={field.placeholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isGroup && (
              <div className="grid gap-1 sm:grid-cols-2" aria-describedby={describedBy}>
                {field.options.map((opt, i) => {
                  const chosen: string[] = watch(fieldName) || []
                  const id = `${field.id}-opt-${i}`
                  return (
                    <div key={opt} className="flex min-h-9 items-center gap-2.5 pointer-coarse:min-h-11">
                      <Checkbox
                        id={id}
                        checked={chosen.includes(opt)}
                        onCheckedChange={(v) => setValue(fieldName, v ? [...chosen, opt] : chosen.filter((c) => c !== opt))}
                      />
                      <label htmlFor={id} className="cursor-pointer text-sm">{opt}</label>
                    </div>
                  )
                })}
              </div>
            )}

            {field.fieldType === "CHECKBOX" && (
              <div className="flex min-h-9 items-center gap-2.5">
                <Checkbox
                  id={field.id}
                  checked={watch(fieldName) || false}
                  onCheckedChange={(v) => setValue(fieldName, !!v)}
                  {...a11y}
                />
                <label htmlFor={field.id} className="cursor-pointer text-sm text-muted-foreground">{field.placeholder || field.label}</label>
              </div>
            )}

            {field.fieldType === "FILE_UPLOAD" && (
              <FileUploadField id={field.id} fieldName={fieldName} form={form} canUpload={canUpload} a11y={a11y} />
            )}

            {field.helpText && (
              <p id={`${field.id}-help`} className="text-[13px] text-muted-foreground">{field.helpText}</p>
            )}
            {error && (
              <p id={`${field.id}-error`} className="text-[13px] text-destructive">{error}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// What POST /api/upload accepts (src/lib/uploads.ts checks the bytes): JPEG, PNG or WebP
// images up to 5 MB, PDFs up to 10 MB. Checked here first so the attendee gets a clear
// message without sending the file.
const MB = 1024 * 1024
const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"

function uploadLimit(file: File): { maxBytes: number; kind: "image" | "PDF" } | null {
  const name = file.name.toLowerCase()
  if (file.type === "application/pdf" || (!file.type && name.endsWith(".pdf"))) return { maxBytes: 10 * MB, kind: "PDF" }
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/.test(name))) {
    return { maxBytes: 5 * MB, kind: "image" }
  }
  return null
}

function uploadFailureMessage(status: number, message: unknown): string {
  if (status === 401) return "Your session has ended. Sign in again to upload the file."
  if (message === "Invalid file type") return "That file isn't a valid JPEG, PNG, WebP image or PDF."
  if (message === "File too large") return "That file is too large: images can be up to 5 MB and PDFs up to 10 MB."
  return typeof message === "string" && message ? message : "The upload failed. Please try again."
}

/**
 * A FILE_UPLOAD question: the chosen file is uploaded straight away and the answer becomes
 * its URL (/uploads/...). While it uploads the answer is FILE_UPLOADING, which the details
 * step won't let past.
 */
function FileUploadField({
  id,
  fieldName,
  form,
  canUpload,
  a11y,
}: {
  id: string
  fieldName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page's form shape varies
  form: UseFormReturn<any>
  canUpload: boolean
  a11y: Record<string, unknown>
}) {
  const { setValue, watch } = form as UseFormReturn<FieldValues>
  const pathname = usePathname()
  const value = watch(fieldName)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // only the latest pick may set the answer, if the attendee picks again mid-upload
  const latest = useRef(0)

  const uploading = isFileUploading(value)
  const uploaded = isUploadedFileUrl(value)

  if (!canUpload) {
    return (
      <div className="space-y-1.5">
        <Input id={id} type="file" disabled {...a11y} />
        <p className="text-[13px] text-muted-foreground">
          Uploading a file needs an account.{" "}
          <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`} className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>{" "}
          to attach it.
        </p>
      </div>
    )
  }

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = "" // so picking the same file again still fires
    if (!file) return
    const request = ++latest.current

    const limit = uploadLimit(file)
    if (!limit) {
      setUploadError("Choose a JPEG, PNG or WebP image, or a PDF.")
      return
    }
    if (file.size > limit.maxBytes) {
      setUploadError(`${file.name} is too large: ${limit.kind === "PDF" ? "PDFs" : "images"} can be up to ${limit.maxBytes / MB} MB.`)
      return
    }

    setUploadError(null)
    setFileName(file.name)
    setValue(fieldName, FILE_UPLOADING)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body })
      const json = await res.json().catch(() => ({}))
      if (request !== latest.current) return
      if (res.ok && json.success && isUploadedFileUrl(json.data?.url)) {
        setValue(fieldName, json.data.url)
      } else {
        setValue(fieldName, "")
        setFileName(null)
        setUploadError(uploadFailureMessage(res.status, json.message))
      }
    } catch {
      if (request !== latest.current) return
      setValue(fieldName, "")
      setFileName(null)
      setUploadError("The upload failed. Check your connection and try again.")
    }
  }

  const remove = () => {
    latest.current++
    setValue(fieldName, "")
    setFileName(null)
    setUploadError(null)
  }

  return (
    <div className="space-y-1.5">
      <Input id={id} type="file" accept={UPLOAD_ACCEPT} disabled={uploading} onChange={onChange} {...a11y} />
      <p className="text-[13px] text-muted-foreground">JPEG, PNG or WebP up to 5 MB, or a PDF up to 10 MB.</p>
      {uploading && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Uploading {fileName}…
        </p>
      )}
      {uploaded && (
        <div className="flex items-center gap-1.5 text-[13px]" role="status">
          <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate">{fileName ?? "File uploaded"}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={remove} aria-label="Remove the uploaded file">
            <X />
          </Button>
        </div>
      )}
      {uploadError && <p className="text-[13px] text-destructive" role="alert">{uploadError}</p>}
    </div>
  )
}
