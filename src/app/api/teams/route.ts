import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import crypto from "crypto"

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars[crypto.randomInt(chars.length)]
    if (i === 3) code += "-"
  }
  return code
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { eventId, teamName } = body

    if (!eventId || !teamName) {
      return NextResponse.json({ success: false, message: "Event ID and team name required" }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { allowTeamRegistration: true, maxTeamSize: true, endDate: true },
    })

    if (!event?.allowTeamRegistration) {
      return NextResponse.json({ success: false, message: "Team registration not enabled" }, { status: 400 })
    }

    // Check user isn't already in a team for this event
    const existingMember = await prisma.teamMember.findFirst({
      where: { userId: session.user.id, team: { eventId } },
    })
    if (existingMember) {
      return NextResponse.json({ success: false, message: "You're already in a team for this event" }, { status: 409 })
    }

    // Invite code expires at event end (or 30 days from now if event has no end date)
    const inviteCodeExpiresAt = event.endDate
      ? new Date(event.endDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const team = await prisma.team.create({
      data: {
        name: teamName,
        eventId,
        leaderId: session.user.id,
        maxSize: event.maxTeamSize || 5,
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt,
        members: {
          create: { userId: session.user.id, role: "LEADER" },
        },
      },
      include: { members: { include: { user: { select: { name: true, email: true } } } } },
    })

    return NextResponse.json({ success: true, data: team }, { status: 201 })
  } catch (error) {
    console.error("Create team error:", error)
    return NextResponse.json({ success: false, message: "Failed to create team" }, { status: 500 })
  }
}
