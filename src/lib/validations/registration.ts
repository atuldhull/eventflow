import { z } from "zod/v4"

export const ticketSelectionSchema = z.object({
  ticketTypeId: z.string().min(1, "Please select a ticket"),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  couponCode: z.string().optional().or(z.literal("")),
})

export type TicketSelectionInput = z.infer<typeof ticketSelectionSchema>

export const registrationDetailsSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.email("Invalid email"),
  phone: z.string().optional().or(z.literal("")),
  agreeToTerms: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
})

export type RegistrationDetailsInput = z.infer<typeof registrationDetailsSchema>

export const teamSchema = z.object({
  mode: z.enum(["create", "join"]),
  teamName: z.string().min(3, "Team name must be at least 3 characters").max(50).optional().or(z.literal("")),
  inviteCode: z.string().optional().or(z.literal("")),
})

export type TeamInput = z.infer<typeof teamSchema>

export const createRegistrationSchema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  formResponses: z.record(z.string(), z.unknown()).optional(),
  teamId: z.string().optional(),
  couponCode: z.string().optional(),
})

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>

export function buildRegistrationSchema(
  customFields: { label: string; fieldType: string; isRequired: boolean; options: string[] }[],
  requirePhone: boolean,
  hasTerms: boolean
) {
  const fieldSchemas: Record<string, z.ZodType> = {}

  for (const field of customFields) {
    let schema: z.ZodType

    switch (field.fieldType) {
      case "TEXT":
      case "TEXTAREA":
        schema = field.isRequired ? z.string().min(1, `${field.label} is required`) : z.string().optional().or(z.literal(""))
        break
      case "EMAIL":
        schema = field.isRequired ? z.email(`Invalid email for ${field.label}`) : z.email().optional().or(z.literal(""))
        break
      case "PHONE":
        schema = field.isRequired ? z.string().min(10, `${field.label} is required`) : z.string().optional().or(z.literal(""))
        break
      case "NUMBER":
        schema = field.isRequired ? z.coerce.number({ error: `${field.label} is required` }) : z.coerce.number().optional()
        break
      case "DATE":
        schema = field.isRequired ? z.string().min(1, `${field.label} is required`) : z.string().optional().or(z.literal(""))
        break
      case "SELECT":
      case "RADIO":
        schema = field.isRequired
          ? z.enum(field.options as [string, ...string[]], { error: `${field.label} is required` })
          : z.string().optional().or(z.literal(""))
        break
      case "MULTI_SELECT":
        schema = field.isRequired
          ? z.array(z.string()).min(1, `Select at least one option for ${field.label}`)
          : z.array(z.string()).optional()
        break
      case "CHECKBOX":
        schema = field.isRequired ? z.literal(true, `${field.label} must be checked`) : z.boolean().optional()
        break
      case "URL":
        schema = field.isRequired ? z.url(`Invalid URL for ${field.label}`) : z.url().optional().or(z.literal(""))
        break
      case "FILE_UPLOAD":
        schema = field.isRequired ? z.string().min(1, `${field.label} is required`) : z.string().optional().or(z.literal(""))
        break
      default:
        schema = z.unknown()
    }

    fieldSchemas[field.label] = schema
  }

  return z.object({
    name: z.string().min(2).max(100),
    email: z.email(),
    phone: requirePhone ? z.string().min(10, "Phone is required") : z.string().optional().or(z.literal("")),
    agreeToTerms: hasTerms ? z.literal(true, "You must agree to the terms") : z.boolean().optional(),
    customFields: z.object(fieldSchemas).optional(),
  })
}
