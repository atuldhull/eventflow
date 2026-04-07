import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { z } from "zod/v4"

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().or(z.literal("")),
  isAnonymous: z.boolean().default(false),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { slug } = await params

  try {
    const body = await request.json()
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })

    const event = await prisma.event.findUnique({ where: { slug }, select: { id: true } })
    if (!event) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })

    // Check if already submitted
    const existing = await prisma.feedback.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
    })
    if (existing) return NextResponse.json({ success: false, message: "Feedback already submitted" }, { status: 409 })

    await prisma.feedback.create({
      data: {
        eventId: event.id,
        userId: session.user.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
        isAnonymous: parsed.data.isAnonymous,
        status: "SUBMITTED",
      },
    })

    return NextResponse.json({ success: true, message: "Feedback submitted" })
  } catch (error) {
    console.error("Feedback error:", error)
    return NextResponse.json({ success: false, message: "Failed to submit feedback" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: true, data: { submitted: false } })

  const { slug } = await params
  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true } })
  if (!event) return NextResponse.json({ success: true, data: { submitted: false } })

  const feedback = await prisma.feedback.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
    select: { rating: true },
  })

  return NextResponse.json({ success: true, data: { submitted: !!feedback, rating: feedback?.rating } })
}
