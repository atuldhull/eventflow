import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  POLL_VOTER_COOKIE,
  getEnabledModuleConfig,
  getPollVoterKey,
  isDuplicateVote,
  pollVoteUniqueKey,
} from "@/lib/live-modules"

type PollOption = { votes?: number; [key: string]: unknown }

function tally(options: PollOption[]) {
  return options.reduce((s, o) => s + (o.votes || 0), 0)
}

// POST — Cast a vote
export async function POST(req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await params

  const poll = await prisma.featureModuleData.findFirst({
    where: { id: pollId, moduleId: "live-poll", dataType: "poll_definition" },
    select: { id: true, data: true, organizationId: true, isActive: true, isPublished: true },
  })

  if (!poll || !poll.isActive || !poll.isPublished) {
    return NextResponse.json({ success: false, message: "Poll not found or closed" }, { status: 404 })
  }

  // Check module enabled, and read the site's poll settings
  let config: Record<string, unknown> = {}
  if (poll.organizationId) {
    const siteConfig = await prisma.siteConfig.findUnique({
      where: { organizationId: poll.organizationId },
      select: { enabledFeatures: true },
    })
    const moduleConfig = getEnabledModuleConfig(siteConfig?.enabledFeatures, "live-poll")
    if (!moduleConfig) {
      return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
    }
    config = moduleConfig
  }
  const allowMultipleVotes = config.allowMultipleVotes === true

  const session = await auth()
  const userId = session?.user?.id ?? null
  const body = await req.json().catch(() => null)
  const optionIndex = body?.optionIndex

  const pollData = poll.data as { question?: string; options?: PollOption[] } | null
  const options: PollOption[] = pollData?.options || []

  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
    return NextResponse.json({ success: false, message: "Invalid option" }, { status: 400 })
  }

  // Identify the voter: the signed-in user, or (only when the poll's site allows guests)
  // an anonymous voter cookie issued here. One ballot per voter per poll is enforced below.
  let newAnonVoterId: string | null = null
  if (!userId && config.requireLogin !== false) {
    return NextResponse.json({ success: false, message: "Please sign in to vote" }, { status: 401 })
  }
  let voterKey = getPollVoterKey(userId, req.cookies.get(POLL_VOTER_COOKIE)?.value)
  if (!voterKey) {
    newAnonVoterId = crypto.randomUUID()
    voterKey = getPollVoterKey(null, newAnonVoterId)!
  }

  const baseKey = pollVoteUniqueKey(pollId, voterKey)
  const uniqueKey = allowMultipleVotes ? pollVoteUniqueKey(pollId, voterKey, optionIndex) : baseKey

  const alreadyVoted = () =>
    NextResponse.json(
      {
        success: false,
        message: "You have already voted in this poll",
        data: { alreadyVoted: true, options, totalVotes: tally(options) },
      },
      { status: 409 }
    )

  // App-level check (friendly message). Also catches ballots cast before uniqueKey existed,
  // which can only be attributed to signed-in voters.
  const previousVotes = await prisma.featureModuleData.findMany({
    where: {
      moduleId: "live-poll",
      dataType: "poll_vote",
      OR: [
        { uniqueKey: baseKey },
        { uniqueKey: { startsWith: `${baseKey}:opt` } },
        ...(userId ? [{ createdById: userId, data: { path: ["pollId"], equals: pollId } }] : []),
      ],
    },
    select: { data: true },
  })
  const previousOptions = previousVotes.map((v) => Number((v.data as { optionIndex?: number } | null)?.optionIndex))
  if (isDuplicateVote(previousOptions, optionIndex, allowMultipleVotes)) {
    return alreadyVoted()
  }

  let updatedOptions: PollOption[]
  try {
    updatedOptions = await prisma.$transaction(async (tx) => {
      // The unique index on uniqueKey rejects a concurrent second ballot from the same voter.
      await tx.featureModuleData.create({
        data: {
          moduleId: "live-poll",
          organizationId: poll.organizationId,
          dataType: "poll_vote",
          title: `Vote on ${pollData?.question || "poll"}`,
          uniqueKey,
          data: {
            pollId,
            optionIndex,
            voterId: userId || "anonymous",
            voterName: session?.user?.name || "Anonymous",
            votedAt: new Date().toISOString(),
          },
          createdById: userId,
        },
      })

      // Lock the poll row and re-read it, so concurrent votes don't overwrite each other's tallies.
      await tx.$queryRaw`SELECT id FROM feature_module_data WHERE id = ${pollId} FOR UPDATE`
      const fresh = await tx.featureModuleData.findUnique({ where: { id: pollId }, select: { data: true } })
      const freshData = (fresh?.data ?? pollData ?? {}) as { options?: PollOption[] }
      const nextOptions = (freshData.options || options).map((opt, i) => ({
        ...opt,
        votes: (opt.votes || 0) + (i === optionIndex ? 1 : 0),
      }))

      await tx.featureModuleData.update({
        where: { id: pollId },
        data: {
          data: { ...freshData, options: nextOptions } as Prisma.InputJsonValue,
          participantCount: { increment: 1 },
          lastActivityAt: new Date(),
        },
      })
      return nextOptions
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return alreadyVoted()
    }
    throw error
  }

  const response = NextResponse.json({
    success: true,
    data: {
      options: updatedOptions,
      totalVotes: tally(updatedOptions),
    },
  })
  if (newAnonVoterId) {
    response.cookies.set(POLL_VOTER_COOKIE, newAnonVoterId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return response
}
