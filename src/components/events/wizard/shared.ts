import { z } from "zod/v4"
import { Calendar, Monitor, Globe } from "lucide-react"
import type { UseFormRegister, UseFormWatch, UseFormSetValue, FieldErrors } from "react-hook-form"
import type { TicketTypeInput, CustomFormFieldInput } from "@/lib/validations/event"

// ── Wizard Schema ──
export const wizardSchema = z.object({
  // Step 1
  title: z.string().min(3, "Min 3 characters").max(150),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens only"),
  shortDescription: z.string().min(10, "Min 10 characters").max(200),
  description: z.string().min(50, "Min 50 characters").max(5000),
  type: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  tags: z.array(z.string()).default([]),
  visibility: z.string().min(1, "Required"),
  // Step 2
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  timezone: z.string().default("Asia/Kolkata"),
  registrationStartDate: z.string().optional().or(z.literal("")),
  registrationEndDate: z.string().optional().or(z.literal("")),
  isOnline: z.boolean().default(false),
  venue: z.string().optional().or(z.literal("")),
  venueAddress: z.string().optional().or(z.literal("")),
  venueCity: z.string().optional().or(z.literal("")),
  venueState: z.string().optional().or(z.literal("")),
  venueCountry: z.string().optional().or(z.literal("")),
  onlinePlatform: z.string().optional().or(z.literal("")),
  onlineLink: z.string().optional().or(z.literal("")),
  // Step 3
  isPaid: z.boolean().default(false),
  maxCapacity: z.string().optional().or(z.literal("")),
  waitlistEnabled: z.boolean().default(false),
  approvalRequired: z.boolean().default(false),
  allowTeamRegistration: z.boolean().default(false),
  minTeamSize: z.string().optional().or(z.literal("")),
  maxTeamSize: z.string().optional().or(z.literal("")),
  allowedEmailDomains: z.string().optional().or(z.literal("")),
  recurrencePattern: z.string().optional().or(z.literal("")),
  recurrenceCount: z.string().optional().or(z.literal("")),
  budgetAmount: z.string().optional().or(z.literal("")),
  budgetNotes: z.string().optional().or(z.literal("")),
  maxGuestsPerRegistration: z.string().optional().or(z.literal("")),
  enableDynamicPricing: z.boolean().default(false),
  dynamicPricingTiers: z.string().optional().or(z.literal("")),
  // Step 4: the optional default fields of the public registration form (event settings)
  collectPhone: z.boolean().default(true),
  collectOrganization: z.boolean().default(false),
  collectDepartment: z.boolean().default(false),
  // Step 5
  coverImage: z.string().optional().or(z.literal("")),
  rules: z.string().optional().or(z.literal("")),
  termsAndConditions: z.string().optional().or(z.literal("")),
  refundPolicy: z.string().optional().or(z.literal("")),
  contactEmail: z.string().optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  seoTitle: z.string().optional().or(z.literal("")),
  seoDescription: z.string().optional().or(z.literal("")),
})

export type WizardFormData = z.infer<typeof wizardSchema>

/** A ticket type in the wizard; `id` is set for ones that already exist (edit mode). */
export type WizardTicketType = TicketTypeInput & { id?: string }

// ── Shared Props ──
export interface StepProps {
  register: UseFormRegister<WizardFormData>
  watch: UseFormWatch<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
  errors: FieldErrors<WizardFormData>
}

export interface TicketsStepProps extends StepProps {
  ticketTypes: WizardTicketType[]
  addTicketType: () => void
  removeTicketType: (i: number) => void
  updateTicketType: (i: number, field: string, value: unknown) => void
  addons: { name: string; price: number; category: string; maxQuantity: number }[]
  setAddons: (v: { name: string; price: number; category: string; maxQuantity: number }[]) => void
}

export interface FormStepProps extends StepProps {
  customFields: CustomFormFieldInput[]
  addCustomField: (fieldType: string) => void
  removeCustomField: (i: number) => void
  updateCustomField: (i: number, field: string, value: unknown) => void
}

export interface MediaStepProps extends StepProps {
  faqs: { question: string; answer: string }[]
  setFaqs: (v: { question: string; answer: string }[]) => void
  sponsors: { name: string; tier: string; website: string }[]
  setSponsors: (v: { name: string; tier: string; website: string }[]) => void
}

export interface ReviewStepProps {
  watch: UseFormWatch<WizardFormData>
  ticketTypes: WizardTicketType[]
  customFields: CustomFormFieldInput[]
  faqs: { question: string; answer: string }[]
  sponsors: { name: string; tier: string; website: string }[]
  addons: { name: string; price: number; category: string; maxQuantity: number }[]
}

// ── Wizard Constants ──
export const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Date & Venue" },
  { id: 3, label: "Tickets" },
  { id: 4, label: "Registration Form" },
  { id: 5, label: "Media & Details" },
  { id: 6, label: "Review & Publish" },
]

export const EVENT_TYPES = [
  { value: "SINGLE", label: "Single Event", description: "One-time event on a single day", icon: Calendar },
  { value: "MULTI_DAY", label: "Multi-Day", description: "Spans multiple days", icon: Calendar },
  { value: "VIRTUAL", label: "Virtual", description: "Fully online event", icon: Monitor },
  { value: "HYBRID", label: "Hybrid", description: "Both in-person and online", icon: Globe },
  { value: "RECURRING", label: "Recurring", description: "Repeats on a schedule (weekly, monthly)", icon: Calendar },
]

export const CATEGORIES = [
  "TECH", "CULTURAL", "SPORTS", "WORKSHOP", "HACKATHON", "CONFERENCE",
  "SEMINAR", "WEBINAR", "FEST", "COMPETITION", "MEETUP",
  "TRAINING", "TOWN_HALL", "TEAM_BUILDING", "CORPORATE", "NETWORKING",
  "OTHER",
]

export const VISIBILITIES = [
  { value: "PUBLIC", label: "Public", description: "Anyone can discover and register" },
  { value: "PRIVATE", label: "Private", description: "Only accessible via direct link" },
  { value: "INVITE_ONLY", label: "Invite Only", description: "Only invited users can register" },
  { value: "UNLISTED", label: "Unlisted", description: "Not shown in search, link required" },
]

export const FIELD_TYPES = [
  { value: "TEXT", label: "Short Text" },
  { value: "TEXTAREA", label: "Long Text" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown" },
  { value: "MULTI_SELECT", label: "Multi-select" },
  { value: "RADIO", label: "Radio" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "FILE_UPLOAD", label: "File Upload" },
  { value: "URL", label: "URL" },
]
