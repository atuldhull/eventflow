"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { HelpCircle, Clock, Trophy, ArrowRight, Check, X, RotateCcw, Share2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Quiz { id: string; title: string; data: any; participantCount: number }
// correctAnswer is only present for the preview sample and for org admins; the API strips it for participants.
interface Question { id: string; question: string; options: string[]; correctAnswer?: number; points: number; timeLimit?: number }
interface AnswerCheck { correct: boolean; points: number; correctAnswer: number | null }

// Score one answer. Without the answer key, ask the server (it reveals the right option
// only after this question has been answered, and only if the quiz shows correct answers).
async function checkAnswer(quizId: string | undefined, question: Question, optionIndex: number): Promise<AnswerCheck> {
  if (typeof question.correctAnswer === "number") {
    const correct = optionIndex === question.correctAnswer
    return { correct, points: correct ? question.points || 10 : 0, correctAnswer: question.correctAnswer }
  }
  try {
    const res = await fetch(`/api/modules/live-quiz/quizzes/${quizId}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, selectedOption: optionIndex }),
    })
    const json = await res.json()
    if (json.success) return json.data as AnswerCheck
  } catch {}
  return { correct: false, points: 0, correctAnswer: null }
}

const SAMPLE_QUIZ: Quiz = {
  id: "sample", title: "Sample Quiz", participantCount: 42,
  data: { title: "Sample Quiz", description: "Test your knowledge!", questions: [
    { id: "q1", question: "What year was the first modern Olympics held?", options: ["1892", "1896", "1900", "1904"], correctAnswer: 1, points: 10 },
    { id: "q2", question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctAnswer: 1, points: 10 },
    { id: "q3", question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], correctAnswer: 2, points: 10 },
  ] },
}

type State = "list" | "intro" | "active" | "complete"

export function LiveQuizModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [state, setState] = useState<State>("list")
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<{ questionId: string; selected: number; correct: boolean; time: number }[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [revealed, setRevealed] = useState<AnswerCheck | null>(null)
  const [score, setScore] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const startTime = useRef(Date.now())

  useEffect(() => {
    if (isPreview) { setQuizzes([SAMPLE_QUIZ]); setIsLoading(false); return }
    async function fetch_() {
      try {
        const res = await fetch(`/api/modules/live-quiz/quizzes?orgSlug=${orgSlug}`)
        const json = await res.json()
        if (json.success) setQuizzes(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, isPreview])

  const questions: Question[] = activeQuiz?.data?.questions || []
  const currentQuestion = questions[currentQ]
  const timePerQ = currentQuestion?.timeLimit || config.timePerQuestion || 30

  // Timer
  useEffect(() => {
    if (state !== "active" || showResult) return
    setTimeLeft(timePerQ)
    startTime.current = Date.now()
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.current) / 1000)
      const remaining = Math.max(0, timePerQ - elapsed)
      setTimeLeft(remaining)
      if (remaining <= 0) { handleAnswer(-1); clearInterval(timer) }
    }, 200)
    return () => clearInterval(timer)
  }, [state, currentQ, showResult, timePerQ])

  const handleAnswer = useCallback(async (optionIndex: number) => {
    if (selected !== null || !currentQuestion) return
    setSelected(optionIndex)
    const timeSpent = Math.floor((Date.now() - startTime.current) / 1000)
    setShowResult(true) // stops the timer while the answer is checked
    const result = await checkAnswer(activeQuiz?.id, currentQuestion, optionIndex)
    setRevealed(result)
    setScore((s) => s + result.points)
    setAnswers((a) => [...a, { questionId: currentQuestion.id, selected: optionIndex, correct: result.correct, time: timeSpent }])
    setTimeout(() => {
      setShowResult(false)
      setSelected(null)
      setRevealed(null)
      if (currentQ + 1 < questions.length) setCurrentQ((q) => q + 1)
      else setState("complete")
    }, 1500)
  }, [selected, currentQuestion, currentQ, questions.length, activeQuiz?.id])

  // Index of the right option once the current answer has been checked (null until then).
  const correctIndex = revealed ? (revealed.correctAnswer ?? (revealed.correct ? selected : null)) : null

  const startQuiz = (quiz: Quiz) => { setActiveQuiz(quiz); setCurrentQ(0); setAnswers([]); setScore(0); setSelected(null); setState("intro") }

  const timerColor = timeLeft > 10 ? "text-green-500" : timeLeft > 5 ? "text-amber-500" : "text-red-500"
  const timerPct = (timeLeft / timePerQ) * 100

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="max-w-2xl mx-auto">
      {/* STATE: LIST */}
      {state === "list" && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2"><HelpCircle className="h-5 w-5" /> Quizzes</h3>
          {quizzes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No quizzes available yet</p> : (
            quizzes.map((quiz) => (
              <motion.div key={quiz.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => startQuiz(quiz)}>
                  <div className="flex items-center justify-between">
                    <div><h4 className="font-semibold">{quiz.data?.title || quiz.title}</h4><p className="text-xs text-muted-foreground mt-0.5">{quiz.data?.questions?.length || 0} questions · {quiz.participantCount} participants</p></div>
                    <Button size="sm" className="gap-1">Start <ArrowRight className="h-3 w-3" /></Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* STATE: INTRO */}
      {state === "intro" && activeQuiz && (
        <motion.div className="text-center space-y-6 py-8" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <HelpCircle className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-2xl font-bold">{activeQuiz.data?.title}</h2>
          {activeQuiz.data?.description && <p className="text-muted-foreground">{activeQuiz.data.description}</p>}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><HelpCircle className="h-4 w-4" />{questions.length} questions</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{config.timePerQuestion}s per question</span>
            {config.bonusForSpeed && <span className="flex items-center gap-1"><Trophy className="h-4 w-4" />Speed bonus</span>}
          </div>
          <Button size="lg" onClick={() => setState("active")} className="px-8">Start Quiz</Button>
          <button onClick={() => setState("list")} className="block mx-auto text-sm text-muted-foreground hover:underline">Back to Quizzes</button>
        </motion.div>
      )}

      {/* STATE: ACTIVE */}
      {state === "active" && currentQuestion && (
        <div className="space-y-6">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Question {currentQ + 1} of {questions.length}</span>
            <span className={`font-bold ${timerColor}`}>{timeLeft}s</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" initial={{ width: "0%" }} animate={{ width: `${((currentQ + (showResult ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
          {/* Timer bar */}
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <motion.div className={`h-full rounded-full ${timeLeft > 10 ? "bg-green-500" : timeLeft > 5 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${timerPct}%` }} transition={{ duration: 0.2 }} />
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div key={currentQ} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
              <h3 className="text-lg sm:text-xl font-medium text-center py-4">{currentQuestion.question}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt: string, i: number) => {
                  const isSelected = selected === i
                  const isCorrect = i === correctIndex
                  const showCorrectState = showResult && revealed !== null && config.showCorrectAnswer
                  let cardClass = "border-2 border-transparent hover:border-primary/30"
                  if (showCorrectState && isCorrect) cardClass = "border-2 border-green-500 bg-green-50 dark:bg-green-950/30"
                  else if (showCorrectState && isSelected && !isCorrect) cardClass = "border-2 border-red-500 bg-red-50 dark:bg-red-950/30"
                  else if (isSelected) cardClass = "border-2 border-primary bg-primary/5"

                  return (
                    <motion.button key={i} onClick={() => !showResult && handleAnswer(i)} disabled={showResult}
                      className={`p-4 rounded-xl text-left transition-all flex items-center gap-3 ${cardClass}`}
                      whileHover={!showResult ? { scale: 1.02 } : {}} whileTap={!showResult ? { scale: 0.98 } : {}}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {showCorrectState && isCorrect ? <Check className="h-4 w-4 text-green-600" /> : showCorrectState && isSelected && !isCorrect ? <X className="h-4 w-4 text-red-600" /> : String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm font-medium">{opt}</span>
                    </motion.button>
                  )
                })}
              </div>
              {showResult && revealed?.correct && (
                <motion.p className="text-center text-green-600 font-bold" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>+{currentQuestion.points} points!</motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* STATE: COMPLETE */}
      {state === "complete" && (
        <motion.div className="text-center space-y-6 py-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.div initial={{ rotate: -10 }} animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5 }}>
            <Trophy className="h-16 w-16 mx-auto text-amber-500" />
          </motion.div>
          <h2 className="text-2xl font-bold">Quiz Complete!</h2>
          <div className="flex justify-center gap-8">
            <div><p className="text-3xl font-bold text-primary">{answers.filter(a => a.correct).length}/{questions.length}</p><p className="text-xs text-muted-foreground">Correct</p></div>
            <div><p className="text-3xl font-bold">{score}</p><p className="text-xs text-muted-foreground">Points</p></div>
            <div><p className="text-3xl font-bold">{Math.round((answers.filter(a => a.correct).length / questions.length) * 100)}%</p><p className="text-xs text-muted-foreground">Score</p></div>
          </div>
          <div className="flex gap-3 justify-center">
            {config.allowRetakes && <Button variant="outline" className="gap-1" onClick={() => { setCurrentQ(0); setAnswers([]); setScore(0); setState("intro") }}><RotateCcw className="h-4 w-4" />Retake</Button>}
            <Button variant="outline" className="gap-1"><Share2 className="h-4 w-4" />Share Score</Button>
            <Button onClick={() => setState("list")}>Back to Quizzes</Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default LiveQuizModule
