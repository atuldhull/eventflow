import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — Get leaderboard entries
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const timeRange = searchParams.get("timeRange") || "all-time"
  const limit = Math.min(Number(searchParams.get("limit") || "25"), 100)

  if (!orgSlug) {
    return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  // Check module enabled
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    select: { enabledFeatures: true },
  })
  const features = (siteConfig?.enabledFeatures as any[]) || []
  if (!features.some((f: any) => f.moduleId === "leaderboard" && f.enabled)) {
    return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
  }

  // Build time filter
  const now = new Date()
  let dateFilter: Date | undefined
  if (timeRange === "this-week") {
    dateFilter = new Date(now.getTime() - 7 * 86400000)
  } else if (timeRange === "this-month") {
    dateFilter = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const where: any = {
    moduleId: "leaderboard",
    organizationId: org.id,
    dataType: "leaderboard_entry",
    isActive: true,
  }
  if (dateFilter) {
    where.updatedAt = { gte: dateFilter }
  }

  const entries = await prisma.featureModuleData.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      data: true,
      sortOrder: true,
      updatedAt: true,
    },
  })

  // Transform to leaderboard format and handle ties
  const sorted = entries
    .map((e: any) => ({
      id: e.id,
      name: (e.data as any)?.name || e.title || "Unknown",
      score: (e.data as any)?.score || 0,
      avatar: (e.data as any)?.avatar,
      source: (e.data as any)?.source || "manual",
      change: (e.data as any)?.change || 0,
      updatedAt: e.updatedAt?.toISOString(),
    }))
    .sort((a, b) => b.score - a.score)

  // Assign ranks (ties get same rank)
  const formatted: (typeof sorted[number] & { rank: number })[] = []
  let currentRank = 1
  sorted.forEach((entry, idx) => {
    const rank = idx > 0 && entry.score === sorted[idx - 1].score
      ? formatted[idx - 1].rank
      : currentRank
    currentRank = idx + 2
    formatted.push({ ...entry, rank })
  })

  // Fetch badges if any
  const badges = await prisma.featureModuleData.findMany({
    where: {
      moduleId: "leaderboard",
      organizationId: org.id,
      dataType: "leaderboard_badge",
      isActive: true,
    },
    select: { id: true, data: true },
  })

  return NextResponse.json({
    success: true,
    data: formatted.slice(0, limit),
    badges: badges.map((b: any) => b.data),
  })
}

// POST — Add manual entry or recalculate (admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const action = searchParams.get("action")

  if (!orgSlug) {
    return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  // Recalculate scores
  if (action === "recalculate") {
    const body = await req.json()
    const { scoreSource } = body

    if (scoreSource === "quiz-scores" || scoreSource === "combined") {
      // Aggregate quiz responses by participant
      const quizResponses = await prisma.featureModuleData.findMany({
        where: { moduleId: "live-quiz", organizationId: org.id, dataType: "quiz_response" },
        select: { data: true },
      })

      const scoreMap = new Map<string, { name: string; score: number }>()
      for (const resp of quizResponses) {
        const d = resp.data as any
        const pid = d.participantId || "unknown"
        const existing = scoreMap.get(pid)
        if (existing) {
          existing.score += d.totalPoints || 0
        } else {
          scoreMap.set(pid, { name: d.participantName || "Unknown", score: d.totalPoints || 0 })
        }
      }

      // Clear existing auto-generated entries
      await prisma.featureModuleData.deleteMany({
        where: {
          moduleId: "leaderboard",
          organizationId: org.id,
          dataType: "leaderboard_entry",
          metadata: { path: ["source"], not: "manual" },
        },
      })

      // Create new entries
      let order = 0
      for (const [pid, { name, score }] of scoreMap) {
        await prisma.featureModuleData.create({
          data: {
            moduleId: "leaderboard",
            organizationId: org.id,
            dataType: "leaderboard_entry",
            title: name,
            data: { name, score, source: scoreSource, participantId: pid },
            metadata: { source: scoreSource },
            sortOrder: order++,
            createdById: session.user.id,
          },
        })
      }
    }

    return NextResponse.json({ success: true, message: "Scores recalculated" })
  }

  // Add manual entry
  const body = await req.json()
  const { name, score } = body

  if (!name || score === undefined) {
    return NextResponse.json({ success: false, message: "Name and score required" }, { status: 400 })
  }

  const entry = await prisma.featureModuleData.create({
    data: {
      moduleId: "leaderboard",
      organizationId: org.id,
      dataType: "leaderboard_entry",
      title: name,
      data: { name, score: Number(score), source: "manual" },
      metadata: { source: "manual" },
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, data: entry }, { status: 201 })
}

// PATCH — Update entry score (admin)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  if (!orgSlug) {
    return NextResponse.json({ success: false, message: "orgSlug required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const body = await req.json()
  const { entryId, score } = body

  const entry = await prisma.featureModuleData.findUnique({ where: { id: entryId } })
  if (!entry || entry.organizationId !== org.id) {
    return NextResponse.json({ success: false, message: "Entry not found" }, { status: 404 })
  }

  const entryData = entry.data as any
  await prisma.featureModuleData.update({
    where: { id: entryId },
    data: {
      data: { ...entryData, score: Number(score) },
      updatedById: session.user.id,
    },
  })

  return NextResponse.json({ success: true })
}

// DELETE — Remove entry (admin)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const orgSlug = searchParams.get("orgSlug")
  const entryId = searchParams.get("entryId")

  if (!orgSlug || !entryId) {
    return NextResponse.json({ success: false, message: "orgSlug and entryId required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: org.id })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const entry = await prisma.featureModuleData.findUnique({ where: { id: entryId } })
  if (!entry || entry.organizationId !== org.id) {
    return NextResponse.json({ success: false, message: "Entry not found" }, { status: 404 })
  }

  await prisma.featureModuleData.delete({ where: { id: entryId } })

  return NextResponse.json({ success: true })
}
