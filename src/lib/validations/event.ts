import { z } from "zod/v4"

export const createEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  location: z.string().optional(),
  isVirtual: z.boolean().default(false),
  maxAttendees: z.number().int().positive().optional(),
  ticketType: z.string().default("FREE"),
})

export type CreateEventInput = z.infer<typeof createEventSchema>
