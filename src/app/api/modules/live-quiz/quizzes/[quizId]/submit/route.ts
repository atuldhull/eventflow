import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST — Submit quiz answers
export async function POST(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const quiz = await prisma.featureModuleData.findUnique({
    where: { id: quizId },
    select: { id: true, data: true, organizationId: true, isActive: true, isPublished: true },
  })

  if (!quiz || !quiz.isActive || !quiz.isPublished) {
    return NextResponse.json({ success: false, message: "Quiz not found or inactive" }, { status: 404 })
  }

  // Check module enabled
  if (quiz.organizationId) {
    const siteConfig = await prisma.siteConfig.findUnique({
      where: { organizationId: quiz.organizationId },
      select: { enabledFeatures: true },
    })
    const features = (siteConfig?.enabledFeatures as any[]) || []
    if (!features.some((f: any) => f.moduleId === "live-quiz" && f.enabled)) {
      return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
    }
  }

  const session = await auth()
  const body = await req.json()
  const { answers } = body as { answers: { questionId: string; selectedOption: number }[] }

  if (!answers?.length) {
    return NextResponse.json({ success: false, message: "Answers required" }, { status: 400 })
  }

  const quizData = quiz.data as any
  const questions: any[] = quizData?.questions || []
  const config = quizData?.settings || {}

  // Score the answers
  let score = 0
  let totalTime = 0
  const scoredAnswers = answers.map((answer) => {
    const question = questions.find((q: any) => q.id === answer.questionId)
    if (!question) return { ...answer, correct: false, timeSpent: 0 }
    const correct = answer.selectedOption === question.correctAnswer
    const points = correct ? (question.points || 10) : 0
    score += points
    return { ...answer, correct, points }
  })

  const correctCount = scoredAnswers.filter((a) => a.correct).length
  const participantId = session?.user?.id || null

  // Dedupe: if this signed-in user has already submitted to THIS quiz, keep their best score.
  // (Anonymous submissions cannot be deduped reliably, so they're always stored.)
  let existingResponseId: string | null = null
  let existingBestPoints = -1
  if (participantId) {
    const prior = await prisma.featureModuleData.findFirst({
      where: {
        moduleId: "live-quiz",
        dataType: "quiz_response",
        organizationId: quiz.organizationId,
        createdById: participantId,
        data: { path: ["quizId"], equals: quizId },
      },
      select: { id: true, data: true },
      orderBy: { createdAt: "desc" },
    })
    if (prior) {
      existingResponseId = prior.id
      existingBestPoints = Number((prior.data as { totalPoints?: number })?.totalPoints ?? 0)
    }
  }

  const responseData = {
    quizId,
    participantId: participantId || "anonymous",
    participantName: session?.user?.name || "Anonymous",
    answers: scoredAnswers,
    score: correctCount,
    totalQuestions: questions.length,
    totalPoints: score,
    completedAt: new Date().toISOString(),
  }

  if (existingResponseId !== null) {
    // Keep the higher of the two scores
    if (score > existingBestPoints) {
      await prisma.featureModuleData.update({
        where: { id: existingResponseId },
        data: { data: responseData },
      })
    }
    // Refresh quiz activity but do NOT bump participantCount (same participant)
    await prisma.featureModuleData.update({
      where: { id: quizId },
      data: { lastActivityAt: new Date() },
    })
  } else {
    await prisma.featureModuleData.create({
      data: {
        moduleId: "live-quiz",
        organizationId: quiz.organizationId,
        dataType: "quiz_response",
        title: `Response to ${quizData?.title || "Quiz"}`,
        data: responseData,
        createdById: participantId,
      },
    })
    await prisma.featureModuleData.update({
      where: { id: quizId },
      data: { participantCount: { increment: 1 }, lastActivityAt: new Date() },
    })
  }

  // Effective score to use in rank = max(new, existing) for logged-in; new for anon
  const effectivePoints = participantId && existingBestPoints >= 0 ? Math.max(score, existingBestPoints) : score

  // Calculate rank — scoped to THIS quiz only (via JSON path on `data.quizId`)
  const quizResponseFilter = {
    moduleId: "live-quiz",
    dataType: "quiz_response",
    organizationId: quiz.organizationId,
    data: { path: ["quizId"], equals: quizId },
  } as const

  const allResponses = await prisma.featureModuleData.count({ where: quizResponseFilter })
  const allScores = await prisma.featureModuleData.findMany({
    where: quizResponseFilter,
    select: { data: true },
  })
  const rank = allScores.filter((r) => Number((r.data as { totalPoints?: number })?.totalPoints ?? 0) > effectivePoints).length + 1

  return NextResponse.json({
    success: true,
    data: {
      score: correctCount,
      total: questions.length,
      totalPoints: score,
      rank,
      totalParticipants: allResponses,
      correctAnswers: scoredAnswers.map((a) => ({
        questionId: a.questionId,
        correct: a.correct,
        selectedOption: a.selectedOption,
      })),
    },
  })
}
