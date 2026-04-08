import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST — Cast a vote
export async function POST(req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await params

  const poll = await prisma.featureModuleData.findUnique({
    where: { id: pollId },
    select: { id: true, data: true, organizationId: true, isActive: true, isPublished: true },
  })

  if (!poll || !poll.isActive || !poll.isPublished) {
    return NextResponse.json({ success: false, message: "Poll not found or closed" }, { status: 404 })
  }

  // Check module enabled
  if (poll.organizationId) {
    const siteConfig = await prisma.siteConfig.findUnique({
      where: { organizationId: poll.organizationId },
      select: { enabledFeatures: true },
    })
    const features = (siteConfig?.enabledFeatures as any[]) || []
    if (!features.some((f: any) => f.moduleId === "live-poll" && f.enabled)) {
      return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
    }
  }

  const session = await auth()
  const body = await req.json()
  const { optionIndex } = body as { optionIndex: number }

  const pollData = poll.data as any
  const options: any[] = pollData?.options || []

  if (optionIndex < 0 || optionIndex >= options.length) {
    return NextResponse.json({ success: false, message: "Invalid option" }, { status: 400 })
  }

  // Store the vote
  await prisma.featureModuleData.create({
    data: {
      moduleId: "live-poll",
      organizationId: poll.organizationId,
      dataType: "poll_vote",
      title: `Vote on ${pollData?.question || "poll"}`,
      data: {
        pollId,
        optionIndex,
        voterId: session?.user?.id || "anonymous",
        voterName: session?.user?.name || "Anonymous",
        votedAt: new Date().toISOString(),
      },
      createdById: session?.user?.id,
    },
  })

  // Update vote count on the poll
  const updatedOptions = options.map((opt: any, i: number) => ({
    ...opt,
    votes: (opt.votes || 0) + (i === optionIndex ? 1 : 0),
  }))

  await prisma.featureModuleData.update({
    where: { id: pollId },
    data: {
      data: { ...pollData, options: updatedOptions },
      participantCount: { increment: 1 },
      lastActivityAt: new Date(),
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      options: updatedOptions,
      totalVotes: updatedOptions.reduce((s: number, o: any) => s + (o.votes || 0), 0),
    },
  })
}
