import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyOTP } from "@/lib/auth-helpers"
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

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or OTP." },
        { status: 401 }
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

    const result = await verifyOTP({
      email: normalizedEmail,
      code: otp,
      purpose: "LOGIN",
    })

    if (!result.valid) {
      const status = result.error?.includes("Too many") ? 429 : 401
      return NextResponse.json(
        { success: false, message: result.error || "Invalid email or OTP." },
        { status }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        emailVerified: user.emailVerified || new Date(),
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: "Login successful.",
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("OTP login error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
