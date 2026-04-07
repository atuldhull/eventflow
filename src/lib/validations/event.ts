import { z } from "zod/v4"

// ============================================================================
// STEP 1: Basic Information
// ============================================================================

export const eventBasicSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(150, "Title must be under 150 characters"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  shortDescription: z.string().min(10, "Must be at least 10 characters").max(200, "Must be under 200 characters"),
  description: z.string().min(50, "Must be at least 50 characters").max(5000, "Must be under 5000 characters"),
  type: z.enum(["SINGLE", "MULTI_DAY", "MULTI_TRACK", "RECURRING", "HYBRID", "VIRTUAL", "IN_PERSON"]),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).max(10, "Maximum 10 tags").default([]),
  visibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY", "UNLISTED"]),
  parentEventId: z.string().optional().or(z.literal("")),
})

export type EventBasicInput = z.infer<typeof eventBasicSchema>

// ============================================================================
// STEP 2: Date & Venue
// ============================================================================

export const eventDateSchema = z.object({
  startDate: z.coerce.date({ error: "Start date is required" }),
  endDate: z.coerce.date({ error: "End date is required" }),
  timezone: z.string().default("Asia/Kolkata"),
  registrationStartDate: z.coerce.date().nullable().optional(),
  registrationEndDate: z.coerce.date().nullable().optional(),
  isOnline: z.boolean().default(false),
  venue: z.string().optional().or(z.literal("")),
  venueAddress: z.string().optional().or(z.literal("")),
  venueCity: z.string().optional().or(z.literal("")),
  venueState: z.string().optional().or(z.literal("")),
  venueCountry: z.string().optional().or(z.literal("")),
  onlinePlatform: z.string().optional().or(z.literal("")),
  onlineLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  onlinePassword: z.string().optional().or(z.literal("")),
})

export type EventDateInput = z.infer<typeof eventDateSchema>

// ============================================================================
// STEP 3: Tickets & Pricing
// ============================================================================

export const ticketTypeSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  description: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  currency: z.string().default("INR"),
  quantity: z.coerce.number().int().positive("Must be positive").nullable().optional(),
  maxPerUser: z.coerce.number().int().min(1).max(10).default(1),
  saleStartDate: z.coerce.date().nullable().optional(),
  saleEndDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  isHidden: z.boolean().default(false),
  sortOrder: z.number().default(0),
})

export type TicketTypeInput = z.infer<typeof ticketTypeSchema>

export const eventTicketsSchema = z.object({
  isPaid: z.boolean().default(false),
  ticketTypes: z.array(ticketTypeSchema).min(1, "At least one ticket type is required"),
  maxCapacity: z.coerce.number().int().positive().nullable().optional(),
  waitlistEnabled: z.boolean().default(false),
  waitlistCapacity: z.coerce.number().int().positive().nullable().optional(),
  approvalRequired: z.boolean().default(false),
  allowTeamRegistration: z.boolean().default(false),
  minTeamSize: z.coerce.number().int().min(2).nullable().optional(),
  maxTeamSize: z.coerce.number().int().min(2).nullable().optional(),
})

export type EventTicketsInput = z.infer<typeof eventTicketsSchema>

// ============================================================================
// STEP 4: Registration Form
// ============================================================================

export const customFormFieldSchema = z.object({
  label: z.string().min(1, "Label is required"),
  fieldType: z.enum([
    "TEXT", "TEXTAREA", "EMAIL", "PHONE", "NUMBER", "DATE",
    "SELECT", "MULTI_SELECT", "CHECKBOX", "RADIO", "FILE_UPLOAD", "URL",
  ]),
  placeholder: z.string().optional().or(z.literal("")),
  helpText: z.string().optional().or(z.literal("")),
  isRequired: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  validation: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().default(0),
})

export type CustomFormFieldInput = z.infer<typeof customFormFieldSchema>

export const eventFormSchema = z.object({
  customFormFields: z.array(customFormFieldSchema).default([]),
  collectPhone: z.boolean().default(false),
  collectCollege: z.boolean().default(false),
  collectCompany: z.boolean().default(false),
})

export type EventFormInput = z.infer<typeof eventFormSchema>

// ============================================================================
// STEP 5: Media & Details
// ============================================================================

export const sponsorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  logo: z.string().optional().or(z.literal("")),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tier: z.string().min(1, "Tier is required"),
  sortOrder: z.number().default(0),
})

export type SponsorInput = z.infer<typeof sponsorSchema>

export const faqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  sortOrder: z.number().default(0),
})

export type FAQInput = z.infer<typeof faqSchema>

export const sessionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  speaker: z.string().optional().or(z.literal("")),
  speakerBio: z.string().optional().or(z.literal("")),
  speakerAvatar: z.string().optional().or(z.literal("")),
  startTime: z.coerce.date({ error: "Start time is required" }),
  endTime: z.coerce.date({ error: "End time is required" }),
  venue: z.string().optional().or(z.literal("")),
  track: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().int().positive().nullable().optional(),
  sortOrder: z.number().default(0),
})

export type SessionInput = z.infer<typeof sessionSchema>

export const eventMediaSchema = z.object({
  coverImage: z.string().optional().or(z.literal("")),
  thumbnailImage: z.string().optional().or(z.literal("")),
  gallery: z.array(z.string()).max(10).default([]),
  rules: z.string().max(5000).optional().or(z.literal("")),
  termsAndConditions: z.string().optional().or(z.literal("")),
  refundPolicy: z.string().optional().or(z.literal("")),
  contactEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  seoTitle: z.string().max(60).optional().or(z.literal("")),
  seoDescription: z.string().max(160).optional().or(z.literal("")),
  seoKeywords: z.array(z.string()).default([]),
  sponsors: z.array(sponsorSchema).default([]),
  faqs: z.array(faqSchema).default([]),
  sessions: z.array(sessionSchema).default([]),
})

export type EventMediaInput = z.infer<typeof eventMediaSchema>

// ============================================================================
// FULL EVENT SCHEMA (for API validation)
// ============================================================================

export const createFullEventSchema = z.object({
  // Basic
  title: z.string().min(3).max(150),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().min(10).max(200),
  description: z.string().min(50).max(5000),
  type: z.enum(["SINGLE", "MULTI_DAY", "MULTI_TRACK", "RECURRING", "HYBRID", "VIRTUAL", "IN_PERSON"]),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY", "UNLISTED"]),
  parentEventId: z.string().optional(),

  // Date
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  timezone: z.string().default("Asia/Kolkata"),
  registrationStartDate: z.coerce.date().optional(),
  registrationEndDate: z.coerce.date().optional(),
  isOnline: z.boolean().default(false),
  venue: z.string().optional(),
  venueAddress: z.string().optional(),
  venueCity: z.string().optional(),
  venueState: z.string().optional(),
  venueCountry: z.string().optional(),
  onlinePlatform: z.string().optional(),
  onlineLink: z.string().optional(),
  onlinePassword: z.string().optional(),

  // Tickets
  isPaid: z.boolean().default(false),
  maxCapacity: z.number().optional(),
  waitlistEnabled: z.boolean().default(false),
  waitlistCapacity: z.number().optional(),
  approvalRequired: z.boolean().default(false),
  allowTeamRegistration: z.boolean().default(false),
  minTeamSize: z.number().optional(),
  maxTeamSize: z.number().optional(),

  // Nested
  ticketTypes: z.array(ticketTypeSchema).default([]),
  customFormFields: z.array(customFormFieldSchema).default([]),
  sessions: z.array(sessionSchema).default([]),
  sponsors: z.array(sponsorSchema).default([]),
  faqs: z.array(faqSchema).default([]),

  // Media
  coverImage: z.string().optional(),
  thumbnailImage: z.string().optional(),
  gallery: z.array(z.string()).default([]),
  rules: z.string().optional(),
  termsAndConditions: z.string().optional(),
  refundPolicy: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.array(z.string()).default([]),

  // Action
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
})

export type CreateFullEventInput = z.infer<typeof createFullEventSchema>
