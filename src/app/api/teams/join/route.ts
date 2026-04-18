import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const inviteCode = (body.inviteCode || "").replace(/-/g, "").trim()

    if (!inviteCode) {
      return NextResponse.json({ success: false, message: "Invite code required" }, { status: 400 })
    }

    // Find team (invite code stored with dash)
    const team = await prisma.team.findFirst({
      where: {
        OR: [
          { inviteCode: inviteCode },
          { inviteCode: body.inviteCode },
        ],
      },
      include: { members: true },
    })

    if (!team) {
      return NextResponse.json({ success: false, message: "Invalid invite code" }, { status: 404 })
    }

    if (team.inviteCodeExpiresAt && team.inviteCodeExpiresAt < new Date()) {
      return NextResponse.json({ success: false, message: "This invite code has expired" }, { status: 410 })
    }

    const alreadyMember = team.members.some((m) => m.userId === session.user.id)
    if (alreadyMember) {
      return NextResponse.json({ success: false, message: "You're already in this team" }, { status: 409 })
    }

    // Re-check capacity inside the transaction and bump atomically
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.team.findUnique({
          where: { id: team.id },
          select: { currentSize: true, maxSize: true, inviteCodeExpiresAt: true },
        })
        if (!fresh) throw new Error("TEAM_GONE")
        if (fresh.inviteCodeExpiresAt && fresh.inviteCodeExpiresAt < new Date()) throw new Error("INVITE_EXPIRED")
        if (fresh.currentSize >= fresh.maxSize) throw new Error("TEAM_FULL")

        await tx.teamMember.create({
          data: { teamId: team.id, userId: session.user.id, role: "MEMBER" },
        })
        await tx.team.update({
          where: { id: team.id },
          data: {
            currentSize: { increment: 1 },
            isComplete: fresh.currentSize + 1 >= fresh.maxSize,
          },
        })
      })
    } catch (err) {
      const code = (err as Error)?.message
      if (code === "TEAM_FULL") return NextResponse.json({ success: false, message: "Team is full" }, { status: 400 })
      if (code === "INVITE_EXPIRED") return NextResponse.json({ success: false, message: "This invite code has expired" }, { status: 410 })
      if (code === "TEAM_GONE") return NextResponse.json({ success: false, message: "Team no longer exists" }, { status: 404 })
      throw err
    }

    const updatedTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: { members: { include: { user: { select: { name: true, email: true } } } } },
    })

    return NextResponse.json({ success: true, data: updatedTeam })
  } catch (error) {
    console.error("Join team error:", error)
    return NextResponse.json({ success: false, message: "Failed to join team" }, { status: 500 })
  }
}
