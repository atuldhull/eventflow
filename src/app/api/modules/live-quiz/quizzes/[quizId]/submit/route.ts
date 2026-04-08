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

  // Store the response
  const response = await prisma.featureModuleData.create({
    data: {
      moduleId: "live-quiz",
      organizationId: quiz.organizationId,
      dataType: "quiz_response",
      title: `Response to ${quizData?.title || "Quiz"}`,
      data: {
        quizId,
        participantId: session?.user?.id || "anonymous",
        participantName: session?.user?.name || "Anonymous",
        answers: scoredAnswers,
        score: correctCount,
        totalQuestions: questions.length,
        totalPoints: score,
        completedAt: new Date().toISOString(),
      },
      createdById: session?.user?.id,
    },
  })

  // Increment participant count on the quiz
  await prisma.featureModuleData.update({
    where: { id: quizId },
    data: {
      participantCount: { increment: 1 },
      lastActivityAt: new Date(),
    },
  })

  // Calculate rank
  const allResponses = await prisma.featureModuleData.count({
    where: {
      moduleId: "live-quiz",
      dataType: "quiz_response",
      organizationId: quiz.organizationId,
    },
  })

  const betterScores = await prisma.featureModuleData.findMany({
    where: {
      moduleId: "live-quiz",
      dataType: "quiz_response",
      organizationId: quiz.organizationId,
    },
    select: { data: true },
  })
  const rank = betterScores.filter((r: any) => (r.data as any)?.totalPoints > score).length + 1

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
