import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { createOTP } from "@/lib/auth-helpers"
import { sendOTPEmail } from "@/lib/email"
import { signupSchema } from "@/lib/validations/auth"
import { getActivePlatformSettings } from "@/lib/platform-settings-store"
import { passwordLengthIssue } from "@/lib/platform-settings"

/**
 * Whether sign-ups are open (Settings → Features → User registration) and the password
 * rule, so the signup page can say "closed" on step 1 instead of after the whole form.
 */
export async function GET() {
  try {
    const platform = await getActivePlatformSettings()
    return NextResponse.json(
      {
        success: true,
        data: {
          open: platform.features.userRegistration,
          minPasswordLength: Math.max(8, platform.security.minPasswordLength),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Signup status error:", error)
    // unknown: let the form show; POST still enforces the setting
    return NextResponse.json({ success: true, data: { open: true, minPasswordLength: 8 } })
  }
}

export async function POST(request: Request) {
  try {
    // Platform settings → Features → User registration
    const platform = await getActivePlatformSettings()
    if (!platform.features.userRegistration) {
      return NextResponse.json({ success: false, message: "New sign-ups are turned off right now." }, { status: 403 })
    }

    const body = await request.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        // the first problem in words ("Invalid Indian phone number"), and every field's for the form
        { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password, name, phone, collegeName, companyName } = parsed.data
    const tooShort = passwordLengthIssue(password, platform)
    if (tooShort) {
      return NextResponse.json({ success: false, message: tooShort, errors: { password: [tooShort] } }, { status: 400 })
    }
    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser && existingUser.emailVerified) {
      return NextResponse.json(
        { success: false, message: "Unable to create account. Please try logging in or use a different email." },
        { status: 409 }
      )
    }

    // Phone uniqueness check (skip checking against the same unverified user we're about to refresh)
    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
      })
      if (existingPhone && existingPhone.id !== existingUser?.id) {
        return NextResponse.json(
          { success: false, message: "Unable to create account with this information. Please try different details." },
          { status: 409 }
        )
      }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // If an unverified account exists, refresh its details rather than deleting it.
    // Deleting would let an attacker replace a victim's in-flight signup.
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            name: name.trim(),
            phone: phone || null,
            collegeName: collegeName || null,
            companyName: companyName || null,
          },
        })
      : await prisma.user.create({
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
