import { z } from "zod/v4"

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    email: z.email("Invalid email address"),
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .max(128, "Maximum 128 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
    name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be under 100 characters"),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Invalid Indian phone number")
      .optional()
      .or(z.literal("")),
    collegeName: z.string().optional().or(z.literal("")),
    companyName: z.string().optional().or(z.literal("")),
    agreeToTerms: z.literal(true, "You must agree to the terms"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export type SignupInput = z.infer<typeof signupSchema>

export const otpSchema = z.object({
  email: z.email("Invalid email address"),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must be numeric"),
})

export type OTPInput = z.infer<typeof otpSchema>

export const forgotPasswordSchema = z.object({
  email: z.email("Invalid email address"),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    email: z.email("Invalid email address"),
    otp: z
      .string()
      .length(6, "OTP must be 6 digits")
      .regex(/^\d+$/, "OTP must be numeric"),
    newPassword: z
      .string()
      .min(8, "Minimum 8 characters")
      .max(128, "Maximum 128 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const sendOtpSchema = z.object({
  email: z.email("Invalid email address"),
  purpose: z.enum(["LOGIN", "VERIFY_EMAIL", "RESET_PASSWORD"]),
})

export type SendOTPInput = z.infer<typeof sendOtpSchema>
