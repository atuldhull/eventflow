import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { verifyOTP } from "@/lib/auth-helpers"
import { withPasswordChangedAt } from "@/lib/password-change"
import { getActivePlatformSettings } from "@/lib/platform-settings-store"
import { passwordLengthIssue } from "@/lib/platform-settings"
import { resetPasswordSchema } from "@/lib/validations/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, otp, newPassword } = parsed.data
    const tooShort = passwordLengthIssue(newPassword, await getActivePlatformSettings())
    if (tooShort) {
      return NextResponse.json({ success: false, message: tooShort, errors: { newPassword: [tooShort] } }, { status: 400 })
    }
    const normalizedEmail = email.toLowerCase().trim()

    const result = await verifyOTP({
      email: normalizedEmail,
      code: otp,
      purpose: "RESET_PASSWORD",
    })

    if (!result.valid) {
      const status = result.error?.includes("Too many") ? 429 : 400
      return NextResponse.json(
        { success: false, message: result.error },
        { status }
      )
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Sessions are JWTs, so they can't be deleted here: recording the change makes every
    // session that signed in before it end at its next refresh (see src/lib/password-change.ts)
    const current = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { metadata: true } })
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash, metadata: withPasswordChangedAt(current?.metadata, new Date()) },
    })

    // Database sessions (unused with the JWT strategy, but cleared in case that changes)
    await prisma.session.deleteMany({
      where: {
        user: { email: normalizedEmail },
      },
    })

    return NextResponse.json(
      { success: true, message: "Password reset successful. Please log in with your new password." },
      { status: 200 }
    )
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
