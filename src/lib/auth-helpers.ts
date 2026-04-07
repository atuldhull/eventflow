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

export async function verifyOTP(params: {
  email: string
  code: string
  purpose: string
}): Promise<{ valid: boolean; error?: string }> {
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
    return { valid: false, error: "No OTP found. Please request a new one." }
  }

  if (otp.expiresAt < new Date()) {
    return { valid: false, error: "OTP has expired. Please request a new one." }
  }

  if (otp.attempts >= 5) {
    return { valid: false, error: "Too many attempts. Please request a new OTP." }
  }

  if (otp.code !== code) {
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })
    return { valid: false, error: "Invalid OTP. Please try again." }
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

export function getRoleRedirectPath(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin"
    case "ENTERPRISE_ADMIN":
    case "ENTERPRISE_MANAGER":
    case "ORG_ADMIN":
    case "EVENT_MANAGER":
    case "COORDINATOR":
    case "FINANCE_MANAGER":
    case "VIEWER":
      return "/admin"
    default:
      return "/dashboard"
  }
}
