import { z } from "zod/v4"

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  image: z.string().url().optional(),
  bio: z.string().max(500, "Bio must be under 500 characters").optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
