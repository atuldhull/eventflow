import type { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import { customFormFieldSchema, faqSchema, sessionSchema, sponsorSchema } from "@/lib/validations/event"

type Tx = Prisma.TransactionClient

// What the organizer event wizard (and the event edit API) may write. Event settings that
// have no column live in event.settings (JSON); the wizard owns the keys below and leaves
// any other key in the object alone.

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

/** An image uploaded through POST /api/upload (served from /uploads/<uuid>.<ext>). */
const UPLOADED_IMAGE = /^\/uploads\/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/i

/** A cover or logo image: an uploaded image, or an https URL. */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || UPLOADED_IMAGE.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v), "Use an uploaded image or an https:// URL")

/** The optional default fields on the public registration form (name and email are always asked). */
export const registrationFieldsSchema = z.object({
  phone: z.boolean(),
  organization: z.boolean(),
  department: z.boolean(),
})
export type RegistrationFields = z.infer<typeof registrationFieldsSchema>

/** Events created before the wizard saved these: phone was always asked, the others never. */
export const DEFAULT_REGISTRATION_FIELDS: RegistrationFields = { phone: true, organization: false, department: false }

export function registrationFieldsFromSettings(settings: unknown): RegistrationFields {
  const raw = settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>).registrationFields
    : undefined
  const parsed = registrationFieldsSchema.partial().safeParse(raw)
  return { ...DEFAULT_REGISTRATION_FIELDS, ...(parsed.success ? parsed.data : {}) }
}

/** Wizard-managed settings keys. `null` removes a key; a missing key is left as it is. */
export const wizardSettingsSchema = z.object({
  allowedEmailDomains: optionalText(500),
  recurrencePattern: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"]).nullable().optional(),
  recurrenceCount: z.number().int().min(1).max(52).nullable().optional(),
  budgetAmount: z.number().min(0).max(1e12).nullable().optional(),
  budgetNotes: optionalText(500),
  maxGuestsPerRegistration: z.number().int().min(0).max(10).nullable().optional(),
  addons: z
    .array(z.object({
      name: z.string().trim().max(100),
      price: z.number().min(0).max(1e7),
      category: z.string().trim().max(50),
      maxQuantity: z.number().int().min(0).max(100),
    }))
    .max(50)
    .nullable()
    .optional(),
  enableDynamicPricing: z.boolean().nullable().optional(),
  dynamicPricingTiers: optionalText(5000),
  registrationFields: registrationFieldsSchema.nullable().optional(),
})
export type WizardSettings = z.infer<typeof wizardSettingsSchema>

export function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
}

/** Applies a wizard settings patch to the stored settings: null deletes, undefined keeps. */
export function mergeEventSettings(current: unknown, patch: WizardSettings | null | undefined): Prisma.InputJsonObject {
  const next = settingsObject(current)
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === undefined) continue
    if (value === null || value === "") delete next[key]
    else next[key] = value
  }
  return next as Prisma.InputJsonObject
}

const updateTicketTypeSchema = z.object({
  id: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1, "Every ticket type needs a name").max(100),
  description: z.string().max(500).nullable().optional(),
  price: z.coerce.number().min(0).max(1e7),
  currency: z.string().trim().max(8).default("INR"),
  quantity: z.coerce.number().int().positive().nullable().optional(),
  maxPerUser: z.coerce.number().int().min(1).max(10).default(1),
  isActive: z.boolean().default(true),
  isHidden: z.boolean().default(false),
})
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>

const nullableDate = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable().optional())
const nullableInt = (min: number) => z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(min).nullable().optional())

/**
 * PATCH /api/admin/org/:orgId/events/:eventId. Only these fields can change; anything else
 * in the body (organizationId, counters, createdById...) is dropped.
 */
export const eventUpdateSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
  shortDescription: z.string().trim().min(10).max(200).optional(),
  description: z.string().trim().min(50).max(5000).optional(),
  type: z.enum(["SINGLE", "MULTI_DAY", "MULTI_TRACK", "RECURRING", "HYBRID", "VIRTUAL", "IN_PERSON"]).optional(),
  category: z.string().trim().max(50).optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY", "UNLISTED"]).optional(),

  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  registrationStartDate: nullableDate,
  registrationEndDate: nullableDate,
  isOnline: z.boolean().optional(),
  venue: optionalText(200),
  venueAddress: optionalText(500),
  venueCity: optionalText(100),
  venueState: optionalText(100),
  venueCountry: optionalText(100),
  onlinePlatform: optionalText(100),
  onlineLink: z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Use a full http(s):// link").nullable().optional(),
  onlinePassword: optionalText(100),

  isPaid: z.boolean().optional(),
  maxCapacity: nullableInt(1),
  waitlistEnabled: z.boolean().optional(),
  waitlistCapacity: nullableInt(1),
  approvalRequired: z.boolean().optional(),
  allowTeamRegistration: z.boolean().optional(),
  minTeamSize: nullableInt(2),
  maxTeamSize: nullableInt(2),

  coverImage: imageUrlSchema.nullable().optional(),
  thumbnailImage: imageUrlSchema.nullable().optional(),
  gallery: z.array(imageUrlSchema).max(10).optional(),
  rules: optionalText(5000),
  termsAndConditions: optionalText(10000),
  refundPolicy: optionalText(5000),
  contactEmail: z.union([z.literal(""), z.email().max(200)]).nullable().optional(),
  contactPhone: optionalText(30),
  seoTitle: optionalText(60),
  seoDescription: optionalText(160),
  seoKeywords: z.array(z.string().trim().max(40)).max(20).optional(),

  settings: wizardSettingsSchema.optional(),
  /** DRAFT keeps the event's status; PUBLISHED publishes a draft (needs event:publish). */
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),

  ticketTypes: z.array(updateTicketTypeSchema).max(50).optional(),
  customFormFields: z.array(customFormFieldSchema).max(100).optional(),
  sessions: z.array(sessionSchema).max(200).optional(),
  sponsors: z.array(sponsorSchema).max(100).optional(),
  faqs: z.array(faqSchema).max(100).optional(),
})
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>

const NESTED_KEYS = ["ticketTypes", "customFormFields", "sessions", "sponsors", "faqs", "settings", "status"] as const

/** The event columns of an update, with "" turned into null for nullable text. */
export function eventColumns(input: EventUpdateInput): Prisma.EventUpdateInput {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || (NESTED_KEYS as readonly string[]).includes(key)) continue
    data[key] = value === "" ? null : value
  }
  return data as Prisma.EventUpdateInput
}

export class TicketQuantityError extends Error {
  constructor(public readonly ticketName: string, public readonly sold: number) {
    super(`"${ticketName}" has already sold ${sold}; its quantity can't be lower than that.`)
    this.name = "TicketQuantityError"
  }
}

/**
 * Brings the event's ticket types in line with the wizard's list without breaking what is
 * already sold: listed ones are updated in place (by id), new ones created, and missing
 * ones deleted, or only switched off when registrations already use them. The previous
 * delete-and-recreate failed on any event with registrations (the foreign key restricts
 * it) and would have reset every sold counter.
 */
export async function syncTicketTypes(tx: Tx, eventId: string, incoming: UpdateTicketTypeInput[]): Promise<void> {
  const existing = await tx.ticketType.findMany({
    where: { eventId },
    select: { id: true, sold: true, _count: { select: { registrations: true } } },
  })
  const byId = new Map(existing.map((t) => [t.id, t]))
  const kept = new Set<string>()

  for (const [i, tt] of incoming.entries()) {
    const fields = {
      name: tt.name,
      description: tt.description || null,
      price: tt.price,
      currency: tt.currency || "INR",
      quantity: tt.quantity ?? null,
      maxPerUser: tt.maxPerUser,
      isActive: tt.isActive,
      isHidden: tt.isHidden,
      sortOrder: i,
    }
    const current = tt.id ? byId.get(tt.id) : undefined
    if (current) {
      if (fields.quantity !== null && fields.quantity < current.sold) throw new TicketQuantityError(tt.name, current.sold)
      await tx.ticketType.update({ where: { id: current.id }, data: fields })
      kept.add(current.id)
    } else {
      await tx.ticketType.create({ data: { ...fields, eventId } })
    }
  }

  for (const t of existing) {
    if (kept.has(t.id)) continue
    if (t._count.registrations > 0 || t.sold > 0) {
      await tx.ticketType.update({ where: { id: t.id }, data: { isActive: false } })
    } else {
      await tx.ticketType.delete({ where: { id: t.id } })
    }
  }
}
