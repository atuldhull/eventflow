import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createOTP, checkOTPRateLimit } from "@/lib/auth-helpers"
import { sendPasswordResetEmail } from "@/lib/email"
import { forgotPasswordSchema } from "@/lib/validations/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    // Always return success to not reveal if email exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (user && user.isActive && !user.isBanned) {
      const withinLimit = await checkOTPRateLimit(normalizedEmail)
      if (withinLimit) {
        const otp = await createOTP({
          email: normalizedEmail,
          userId: user.id,
          purpose: "RESET_PASSWORD",
        })
        await sendPasswordResetEmail(normalizedEmail, otp)
      }
    }

    return NextResponse.json(
      { success: true, message: "If an account exists with this email, you'll receive a reset code." },
      { status: 200 }
    )
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
