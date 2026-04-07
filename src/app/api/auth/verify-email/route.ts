import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyOTP } from "@/lib/auth-helpers"
import { sendWelcomeEmail } from "@/lib/email"
import { otpSchema } from "@/lib/validations/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = otpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, otp } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const result = await verifyOTP({
      email: normalizedEmail,
      code: otp,
      purpose: "VERIFY_EMAIL",
    })

    if (!result.valid) {
      const status = result.error?.includes("Too many") ? 429 : 400
      return NextResponse.json(
        { success: false, message: result.error },
        { status }
      )
    }

    const user = await prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: new Date() },
    })

    await sendWelcomeEmail(normalizedEmail, user.name)

    return NextResponse.json(
      { success: true, message: "Email verified successfully." },
      { status: 200 }
    )
  } catch (error) {
    console.error("Verify email error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
