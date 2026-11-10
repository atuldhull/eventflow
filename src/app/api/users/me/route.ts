import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { rateLimiter, RATE_LIMITS } from "@/lib/rate-limiter"
import { checkDeletionConfirmation, deleteAccount } from "@/lib/account-deletion"

// What the settings page needs to ask for the right confirmation before deleting.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, passwordHash: true } })
  if (!user) return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: { email: user.email, hasPassword: !!user.passwordHash } })
}

// "Delete my account": confirmed with the password (or DELETE / the email for accounts
// that only use Google or Microsoft). The client signs out after a success.
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const body = await request.json().catch(() => ({}))
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true, deletedAt: true } })
  if (!user || user.deletedAt) {
    return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 })
  }

  // Wrong passwords count like failed sign-ins, so this can't be used to guess one.
  const attempts = await rateLimiter.peek(`account-delete:${userId}`, RATE_LIMITS.auth.limit)
  if (!attempts.allowed) {
    return NextResponse.json({ success: false, message: "Too many attempts. Try again later." }, { status: 429 })
  }
  const confirmed = await checkDeletionConfirmation(user, body ?? {})
  if (!confirmed.ok) {
    if (user.passwordHash) await rateLimiter.check(`account-delete:${userId}`, RATE_LIMITS.auth.limit, RATE_LIMITS.auth.windowMs)
    return NextResponse.json({ success: false, message: confirmed.message }, { status: confirmed.status })
  }

  const result = await deleteAccount(userId)
  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status })
  }
  await rateLimiter.reset(`account-delete:${userId}`)

  return NextResponse.json({
    success: true,
    message: "Your account has been deleted",
    data: { cancelledRegistrations: result.cancelledRegistrations },
  })
}
