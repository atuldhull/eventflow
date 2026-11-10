import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createOTP, checkOTPRateLimit } from "@/lib/auth-helpers"
import { sendOTPEmail } from "@/lib/email"
import { sendOtpSchema } from "@/lib/validations/auth"
import { rateLimiter } from "@/lib/rate-limiter"

function getClientIp(request: Request): string {
  const headers = request.headers
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  )
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const ipLimit = await rateLimiter.check(`send-otp:ip:${ip}`, 10, 60_000) // 10/min per IP
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter ?? 60) } }
      )
    }

    const body = await request.json()
    const parsed = sendOtpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, purpose } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    // For LOGIN and RESET_PASSWORD, user must exist
    if (purpose === "LOGIN" || purpose === "RESET_PASSWORD") {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      })

      if (!user) {
        // Don't reveal if user exists
        return NextResponse.json(
          { success: true, message: "If an account exists, an OTP has been sent." },
          { status: 200 }
        )
      }

      if (!user.isActive) {
        return NextResponse.json(
          { success: false, message: "Your account has been suspended. Contact support." },
          { status: 403 }
        )
      }

      if (user.isBanned) {
        return NextResponse.json(
          { success: false, message: "Your account has been suspended. Contact support." },
          { status: 403 }
        )
      }
    }

    const withinLimit = await checkOTPRateLimit(normalizedEmail)
    if (!withinLimit) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    const otp = await createOTP({
      email: normalizedEmail,
      userId: user?.id,
      purpose,
    })

    await sendOTPEmail(normalizedEmail, otp, purpose)

    return NextResponse.json(
      { success: true, message: "OTP sent to your email." },
      { status: 200 }
    )
  } catch (error) {
    console.error("Send OTP error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
