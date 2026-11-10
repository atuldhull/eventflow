import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createOTP, verifyOTP } from "@/lib/auth-helpers"
import { sendWelcomeEmail } from "@/lib/email"
import { otpSchema } from "@/lib/validations/auth"
import { acceptPendingInvites } from "@/lib/org-invites"
import { acceptEnterprisePendingInvites } from "@/lib/enterprise-invites"

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

    // The address is now proven: turn any organization and enterprise invitations sent to it into
    // memberships. A failure here must not fail the verification; the next sign-in retries.
    try {
      await acceptPendingInvites({ id: user.id, email: user.email, name: user.name })
      await acceptEnterprisePendingInvites({ id: user.id, email: user.email, name: user.name })
    } catch (error) {
      console.error("Accepting pending invitations failed:", error)
    }

    // { signIn: true } (the /verify-email page): the caller has just proven they read this
    // inbox, which is exactly what a one-time sign-in code proves, so hand back a fresh
    // single-use LOGIN code (10 minutes) the page exchanges for a session straight away
    // through the "otp" provider, which re-checks the account (active, not banned).
    let loginCode: string | undefined
    if (body?.signIn === true && user.isActive && !user.isBanned && !user.deletedAt) {
      loginCode = await createOTP({ email: normalizedEmail, userId: user.id, purpose: "LOGIN" })
    }

    return NextResponse.json(
      { success: true, message: "Email verified successfully.", ...(loginCode ? { data: { loginCode } } : {}) },
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
