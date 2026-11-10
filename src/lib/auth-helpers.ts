import crypto from "crypto"
import prisma from "@/lib/prisma"

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export async function createOTP(params: {
  email: string
  userId?: string
  purpose: string
}): Promise<string> {
  const { email, userId, purpose } = params

  // Invalidate existing unused OTPs for this email+purpose
  await prisma.oTP.updateMany({
    where: {
      email,
      purpose,
      isUsed: false,
    },
    data: { isUsed: true },
  })

  const code = generateOTP()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await prisma.oTP.create({
    data: {
      userId,
      email,
      code,
      purpose,
      expiresAt,
    },
  })

  return code
}

export type OTPFailureReason = "not_found" | "expired" | "too_many_attempts" | "invalid"

export async function verifyOTP(params: {
  email: string
  code: string
  purpose: string
}): Promise<{ valid: boolean; error?: string; reason?: OTPFailureReason }> {
  const { email, code, purpose } = params

  const otp = await prisma.oTP.findFirst({
    where: {
      email,
      purpose,
      isUsed: false,
    },
    orderBy: { createdAt: "desc" },
  })

  if (!otp) {
    return { valid: false, error: "No OTP found. Please request a new one.", reason: "not_found" }
  }

  if (otp.expiresAt < new Date()) {
    return { valid: false, error: "OTP has expired. Please request a new one.", reason: "expired" }
  }

  if (otp.attempts >= 5) {
    return { valid: false, error: "Too many attempts. Please request a new OTP.", reason: "too_many_attempts" }
  }

  const storedBuf = Buffer.from(otp.code)
  const inputBuf = Buffer.from(code)
  const codeMatches =
    storedBuf.length === inputBuf.length && crypto.timingSafeEqual(storedBuf, inputBuf)

  if (!codeMatches) {
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })
    return { valid: false, error: "Invalid OTP. Please try again.", reason: "invalid" }
  }

  await prisma.oTP.update({
    where: { id: otp.id },
    data: { isUsed: true },
  })

  return { valid: true }
}

export async function checkOTPRateLimit(email: string): Promise<boolean> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

  const count = await prisma.oTP.count({
    where: {
      email,
      createdAt: { gte: tenMinutesAgo },
    },
  })

  return count < 3
}

export { getRoleRedirectPath } from "@/lib/auth-redirect"
