import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { createOTP } from "@/lib/auth-helpers"
import { sendOTPEmail } from "@/lib/email"
import { signupSchema } from "@/lib/validations/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password, name, phone, collegeName, companyName } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "This email is already registered. Try logging in." },
        { status: 409 }
      )
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
      })
      if (existingPhone) {
        return NextResponse.json(
          { success: false, message: "This phone number is already in use." },
          { status: 409 }
        )
      }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        phone: phone || null,
        collegeName: collegeName || null,
        companyName: companyName || null,
        role: "USER",
      },
    })

    const otp = await createOTP({
      email: normalizedEmail,
      userId: user.id,
      purpose: "VERIFY_EMAIL",
    })

    await sendOTPEmail(normalizedEmail, otp, "VERIFY_EMAIL")

    return NextResponse.json(
      { success: true, message: "Account created. Please verify your email.", data: { userId: user.id } },
      { status: 201 }
    )
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
