import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getEnabledModuleConfig } from "@/lib/live-modules"

// POST — Check one answer while a participant plays the quiz.
// The quiz GET no longer sends the answer key to participants, so the player asks the
// server whether the option it just picked is right. The correct option index is only
// revealed for a question the participant has answered, and only when the site's quiz
// config shows correct answers (the same rule the player UI applies).
export async function POST(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params

  const quiz = await prisma.featureModuleData.findFirst({
    where: { id: quizId, moduleId: "live-quiz", dataType: "quiz_definition" },
    select: { data: true, organizationId: true, isActive: true, isPublished: true },
  })

  if (!quiz || !quiz.isActive || !quiz.isPublished) {
    return NextResponse.json({ success: false, message: "Quiz not found or inactive" }, { status: 404 })
  }

  let showCorrectAnswer = true
  if (quiz.organizationId) {
    const siteConfig = await prisma.siteConfig.findUnique({
      where: { organizationId: quiz.organizationId },
      select: { enabledFeatures: true },
    })
    const config = getEnabledModuleConfig(siteConfig?.enabledFeatures, "live-quiz")
    if (!config) {
      return NextResponse.json({ success: false, message: "This feature is not available" }, { status: 404 })
    }
    showCorrectAnswer = config.showCorrectAnswer !== false
  }

  const body = await req.json().catch(() => null)
  const questionId = body?.questionId
  const selectedOption = body?.selectedOption
  if (typeof questionId !== "string" || !Number.isInteger(selectedOption)) {
    return NextResponse.json({ success: false, message: "questionId and selectedOption are required" }, { status: 400 })
  }

  const questions: { id?: string; correctAnswer?: number; points?: number }[] =
    (quiz.data as { questions?: { id?: string; correctAnswer?: number; points?: number }[] } | null)?.questions || []
  const question = questions.find((q) => q.id === questionId)
  if (!question) {
    return NextResponse.json({ success: false, message: "Question not found" }, { status: 404 })
  }

  const correct = selectedOption === question.correctAnswer
  return NextResponse.json({
    success: true,
    data: {
      correct,
      points: correct ? question.points || 10 : 0,
      correctAnswer: showCorrectAnswer ? question.correctAnswer ?? null : null,
    },
  })
}
