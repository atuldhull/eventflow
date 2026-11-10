import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { withPasswordChangedAt } from "@/lib/password-change"
import { getActivePlatformSettings } from "@/lib/platform-settings-store"
import { passwordLengthIssue } from "@/lib/platform-settings"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { currentPassword, newPassword } = await request.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, message: "Both current and new passwords are required" }, { status: 400 })
  }

  if (typeof newPassword !== "string" || typeof currentPassword !== "string") {
    return NextResponse.json({ success: false, message: "Both current and new passwords are required" }, { status: 400 })
  }
  // at least 8, or the platform's minimum (Platform settings → Security)
  const tooShort = passwordLengthIssue(newPassword, await getActivePlatformSettings())
  if (tooShort) {
    return NextResponse.json({ success: false, message: `New ${tooShort.charAt(0).toLowerCase()}${tooShort.slice(1)}` }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, metadata: true },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ success: false, message: "Account uses social login. Password cannot be changed here." }, { status: 400 })
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isValid) {
    return NextResponse.json({ success: false, message: "Current password is incorrect" }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12)
  // Every session that signed in before now, this one included, ends at its next refresh
  // (see src/lib/password-change.ts). The settings page signs this device straight back in
  // with the new password, so only the other devices are signed out.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hashedPassword, metadata: withPasswordChangedAt(user.metadata, new Date()) },
  })

  return NextResponse.json({ success: true, message: "Password changed successfully" })
}
