import { z } from "zod/v4"

/**
 * The register page's "Your details" step: which built-in fields to ask for, and the
 * checks to run before the attendee may move on to Review.
 */

export type FieldMode = "hidden" | "optional" | "required"

export interface DefaultFields {
  phone: FieldMode
  organization: FieldMode
  department: FieldMode
}

/** Events whose form API doesn't say: phone asked (optional), nothing else, as the page always did. */
export const FALLBACK_DEFAULT_FIELDS: DefaultFields = { phone: "optional", organization: "hidden", department: "hidden" }

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/**
 * One switch. The wizard's "Ask for …" switches are booleans: on = ask (optional), off =
 * don't ask. "required" | "optional" | "hidden" or { enabled, required } are accepted too,
 * so a later "required" option needs no change here.
 */
function readMode(value: unknown): FieldMode | undefined {
  if (typeof value === "boolean") return value ? "optional" : "hidden"
  if (typeof value === "string") {
    const v = value.toLowerCase()
    if (v === "required" || v === "optional" || v === "hidden") return v
    return undefined
  }
  if (isRecord(value)) {
    if (value.enabled === false) return "hidden"
    if (value.required === true) return "required"
    if (value.enabled === true || value.required === false) return "optional"
  }
  return undefined
}

/**
 * Reads `registrationFields: { phone, organization, department }` from GET
 * /api/events/[slug]/form (the event's settings.registrationFields, set in the event
 * wizard). A missing or unreadable value keeps the fallback.
 */
export function readDefaultFields(formConfig: unknown): DefaultFields {
  const result: DefaultFields = { ...FALLBACK_DEFAULT_FIELDS }
  const fields = isRecord(formConfig) ? formConfig.registrationFields : undefined
  if (!isRecord(fields)) return result
  for (const key of Object.keys(result) as (keyof DefaultFields)[]) {
    const mode = readMode(fields[key])
    if (mode) result[key] = mode
  }
  return result
}

export interface CustomField {
  id: string
  label: string
  fieldType: string
  isRequired: boolean
  options?: string[] | null
  validation?: unknown
}

export interface DetailsValues {
  name?: string
  email?: string
  phone?: string
  organization?: string
  department?: string
  agreeToTerms?: boolean
  /** keyed by field id */
  customFields?: Record<string, unknown>
}

/** Errors keyed by the form path: name, email, phone, organization, department, agreeToTerms, customFields.<id> */
export type DetailsErrors = Record<string, string>

const emailSchema = z.email()

/**
 * FILE_UPLOAD answers: the file is sent to POST /api/upload as soon as it is chosen and the
 * answer is the URL that returns (/uploads/<random name>). While it is on its way the answer
 * is FILE_UPLOADING, which blocks moving on.
 */
export const FILE_UPLOADING = { uploading: true } as const
const UPLOADED_FILE_URL = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
export const isUploadedFileUrl = (v: unknown): v is string => typeof v === "string" && UPLOADED_FILE_URL.test(v)
export const isFileUploading = (v: unknown) => isRecord(v) && v.uploading === true

const digits = (s: string) => s.replace(/\D/g, "").length
const isPhone = (s: string) => /^[+()\d\s.-]+$/.test(s) && digits(s) >= 10 && digits(s) <= 15

function isHttpUrl(s: string) {
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

const isEmpty = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0)

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)

function checkCustomField(field: CustomField, value: unknown): string | undefined {
  const label = field.label || "This field"
  const rules = isRecord(field.validation) ? field.validation : {}

  if (field.fieldType === "CHECKBOX") {
    return field.isRequired && value !== true ? `${label} must be checked` : undefined
  }
  if (isEmpty(value)) {
    if (!field.isRequired) return undefined
    return field.fieldType === "MULTI_SELECT" ? `Select at least one option for ${label}` : `${label} is required`
  }

  const text = typeof value === "string" ? value.trim() : ""
  switch (field.fieldType) {
    case "EMAIL":
      return emailSchema.safeParse(text).success ? undefined : `Enter a valid email for ${label}`
    case "URL":
      return isHttpUrl(text) ? undefined : `Enter a full link for ${label}, starting with https://`
    case "PHONE":
      return isPhone(text) ? undefined : `Enter a valid phone number for ${label}`
    case "NUMBER": {
      const n = typeof value === "number" ? value : Number(text)
      if (!Number.isFinite(n)) return `${label} must be a number`
      const min = num(rules.min)
      const max = num(rules.max)
      if (min !== undefined && n < min) return `${label} must be at least ${min}`
      if (max !== undefined && n > max) return `${label} must be at most ${max}`
      return undefined
    }
    case "FILE_UPLOAD":
      if (isFileUploading(value)) return `Wait for ${label} to finish uploading`
      return isUploadedFileUrl(value) ? undefined : `Upload a file for ${label}`
    case "SELECT":
    case "RADIO":
      return field.options?.length && !field.options.includes(text) ? `Choose one of the options for ${label}` : undefined
    case "MULTI_SELECT":
      return Array.isArray(value) && field.options?.length && value.some((v) => !field.options!.includes(String(v)))
        ? `Choose from the listed options for ${label}`
        : undefined
    case "TEXT":
    case "TEXTAREA": {
      const minLength = num(rules.minLength)
      const maxLength = num(rules.maxLength)
      if (minLength !== undefined && text.length < minLength) return `${label} must be at least ${minLength} characters`
      if (maxLength !== undefined && text.length > maxLength) return `${label} must be at most ${maxLength} characters`
      return undefined
    }
    default:
      return undefined
  }
}

export function validateRegistrationDetails(
  values: DetailsValues,
  options: { defaultFields: DefaultFields; customFields: CustomField[]; requireTerms: boolean },
): DetailsErrors {
  const errors: DetailsErrors = {}
  const name = (values.name ?? "").trim()
  const email = (values.email ?? "").trim()

  if (name.length < 2) errors.name = "Enter your full name"
  else if (name.length > 100) errors.name = "Name must be at most 100 characters"

  if (!email) errors.email = "Enter your email"
  else if (!emailSchema.safeParse(email).success) errors.email = "Enter a valid email address"

  const phone = (values.phone ?? "").trim()
  if (options.defaultFields.phone !== "hidden") {
    if (!phone) {
      if (options.defaultFields.phone === "required") errors.phone = "Enter your phone number"
    } else if (!isPhone(phone)) {
      errors.phone = "Enter a valid phone number, e.g. +91 98765 43210"
    }
  }

  for (const key of ["organization", "department"] as const) {
    const mode = options.defaultFields[key]
    const value = (values[key] ?? "").trim()
    if (mode === "required" && !value) errors[key] = key === "organization" ? "Enter your organization or institution" : "Enter your department"
    else if (mode !== "hidden" && value.length > 200) errors[key] = "Must be at most 200 characters"
  }

  for (const field of options.customFields) {
    const error = checkCustomField(field, values.customFields?.[field.id])
    if (error) errors[`customFields.${field.id}`] = error
  }

  if (options.requireTerms && values.agreeToTerms !== true) {
    errors.agreeToTerms = "Accept the terms and conditions to continue"
  }

  return errors
}
