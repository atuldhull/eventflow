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
      return NextResponse.json({ success: false, message: "Team not found" }, { status: 404 })
    }

    if (team.currentSize >= team.maxSize) {
      return NextResponse.json({ success: false, message: "Team is full" }, { status: 400 })
    }

    const alreadyMember = team.members.some((m) => m.userId === session.user.id)
    if (alreadyMember) {
      return NextResponse.json({ success: false, message: "You're already in this team" }, { status: 409 })
    }

    await prisma.$transaction([
      prisma.teamMember.create({
        data: { teamId: team.id, userId: session.user.id, role: "MEMBER" },
      }),
      prisma.team.update({
        where: { id: team.id },
        data: {
          currentSize: { increment: 1 },
          isComplete: team.currentSize + 1 >= team.maxSize,
        },
      }),
    ])

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
