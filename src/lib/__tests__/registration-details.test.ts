import { describe, it, expect } from "vitest"
import {
  FALLBACK_DEFAULT_FIELDS,
  FILE_UPLOADING,
  readDefaultFields,
  validateRegistrationDetails,
  type CustomField,
  type DefaultFields,
} from "@/lib/registration-details"

// The register page's "Your details" step: which built-in fields the event asks for, and
// what must be filled in before Review.

describe("readDefaultFields", () => {
  it("falls back to phone-optional when the form API sends no registrationFields", () => {
    expect(readDefaultFields({ eventId: "e1", customFields: [] })).toEqual(FALLBACK_DEFAULT_FIELDS)
    expect(readDefaultFields({ registrationFields: null })).toEqual(FALLBACK_DEFAULT_FIELDS)
    expect(readDefaultFields(null)).toEqual(FALLBACK_DEFAULT_FIELDS)
  })

  it("reads the wizard's Ask-for switches: on = asked (optional), off = not asked", () => {
    expect(readDefaultFields({ registrationFields: { phone: false, organization: true, department: true } })).toEqual({
      phone: "hidden", organization: "optional", department: "optional",
    })
    expect(readDefaultFields({ registrationFields: { phone: true, organization: false, department: false } })).toEqual(FALLBACK_DEFAULT_FIELDS)
  })

  it("accepts explicit modes and { enabled, required }", () => {
    expect(readDefaultFields({ registrationFields: { phone: "required", organization: { enabled: true, required: true }, department: { enabled: false } } })).toEqual({
      phone: "required", organization: "required", department: "hidden",
    })
  })

  it("keeps the fallback for values it can't read, and ignores look-alike keys elsewhere", () => {
    expect(readDefaultFields({ registrationFields: { phone: "maybe", organization: 1 } })).toEqual(FALLBACK_DEFAULT_FIELDS)
    expect(readDefaultFields({ organization: { id: "o", name: "Tech Club" }, collectDepartment: true })).toEqual(FALLBACK_DEFAULT_FIELDS)
  })
})

const FIELDS: DefaultFields = { phone: "optional", organization: "hidden", department: "hidden" }
const valid = { name: "Carol Danvers", email: "carol@test.local", phone: "", agreeToTerms: false, customFields: {} }
const check = (values: Record<string, unknown>, opts: Partial<{ defaultFields: DefaultFields; customFields: CustomField[]; requireTerms: boolean }> = {}) =>
  validateRegistrationDetails({ ...valid, ...values }, { defaultFields: FIELDS, customFields: [], requireTerms: false, ...opts })

describe("validateRegistrationDetails", () => {
  it("passes a complete form", () => {
    expect(check({})).toEqual({})
  })

  it("requires a name and a valid email", () => {
    expect(check({ name: " ", email: "" })).toEqual({ name: "Enter your full name", email: "Enter your email" })
    expect(check({ email: "carol@" }).email).toBe("Enter a valid email address")
  })

  it("requires the terms checkbox when the event has terms", () => {
    expect(check({}, { requireTerms: true }).agreeToTerms).toMatch(/terms/)
    expect(check({ agreeToTerms: true }, { requireTerms: true })).toEqual({})
  })

  it("checks phone: optional but well-formed, required when switched on, ignored when hidden", () => {
    expect(check({ phone: "12ab" }).phone).toMatch(/valid phone/)
    expect(check({ phone: "+91 98765 43210" })).toEqual({})
    expect(check({ phone: "" }, { defaultFields: { ...FIELDS, phone: "required" } }).phone).toBe("Enter your phone number")
    expect(check({ phone: "12ab" }, { defaultFields: { ...FIELDS, phone: "hidden" } })).toEqual({})
  })

  it("requires organization and department when the event asks for them", () => {
    const errors = check({ organization: " ", department: "" }, { defaultFields: { phone: "hidden", organization: "required", department: "required" } })
    expect(errors).toEqual({ organization: "Enter your organization or institution", department: "Enter your department" })
  })

  it("checks required and typed custom fields, keyed by field id", () => {
    const customFields: CustomField[] = [
      { id: "f1", label: "T-shirt size", fieldType: "SELECT", isRequired: true, options: ["S", "M", "L"] },
      { id: "f2", label: "Portfolio", fieldType: "URL", isRequired: false },
      { id: "f3", label: "Tracks", fieldType: "MULTI_SELECT", isRequired: true, options: ["AI", "Web"] },
      { id: "f4", label: "Code of conduct", fieldType: "CHECKBOX", isRequired: true },
      { id: "f5", label: "Age", fieldType: "NUMBER", isRequired: true, validation: { min: 16 } },
      { id: "f6", label: "B.Tech branch", fieldType: "TEXT", isRequired: true },
      { id: "f7", label: "Resume", fieldType: "FILE_UPLOAD", isRequired: true },
    ]
    const errors = check({ customFields: { f1: "XL", f2: "javascript:alert(1)", f3: [], f5: "12", f6: "  ", f7: "" } }, { customFields })
    expect(errors).toEqual({
      "customFields.f1": "Choose one of the options for T-shirt size",
      "customFields.f2": "Enter a full link for Portfolio, starting with https://",
      "customFields.f3": "Select at least one option for Tracks",
      "customFields.f4": "Code of conduct must be checked",
      "customFields.f5": "Age must be at least 16",
      "customFields.f6": "B.Tech branch is required",
      "customFields.f7": "Resume is required",
    })

    expect(check({ customFields: { f1: "M", f2: "", f3: ["AI"], f4: true, f5: "21", f6: "CSE", f7: "/uploads/0b9e7c2a-1d2f-4e8a-9c1b-3f4a5b6c7d8e.pdf" } }, { customFields })).toEqual({})
  })

  it("accepts a FILE_UPLOAD answer only once the file is uploaded", () => {
    const customFields: CustomField[] = [
      { id: "f1", label: "Resume", fieldType: "FILE_UPLOAD", isRequired: true },
      { id: "f2", label: "Photo", fieldType: "FILE_UPLOAD", isRequired: false },
    ]
    expect(check({ customFields: { f1: FILE_UPLOADING, f2: FILE_UPLOADING } }, { customFields })).toEqual({
      "customFields.f1": "Wait for Resume to finish uploading",
      "customFields.f2": "Wait for Photo to finish uploading",
    })
    // a chosen-but-not-uploaded file, or a link from anywhere else, isn't an upload
    expect(check({ customFields: { f1: { length: 1 }, f2: "https://evil.example/x.pdf" } }, { customFields })).toEqual({
      "customFields.f1": "Upload a file for Resume",
      "customFields.f2": "Upload a file for Photo",
    })
    // optional and left empty is fine
    expect(check({ customFields: { f1: "/uploads/a.png", f2: "" } }, { customFields })).toEqual({})
    expect(check({ customFields: { f1: "/uploads/../secret" } }, { customFields })).toEqual({ "customFields.f1": "Upload a file for Resume" })
  })
})
