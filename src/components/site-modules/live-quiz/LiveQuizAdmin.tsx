"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical, Loader2, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface QuizQuestion { id: string; question: string; options: string[]; correctAnswer: number; points: number }

export function LiveQuizAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    async function fetch_() {
      try {
        const res = await fetch(`/api/modules/live-quiz/quizzes?orgSlug=${orgSlug}&status=all`)
        const json = await res.json()
        if (json.success) setQuizzes(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, isPreview])

  const addQuestion = () => {
    if (questions.length >= (config.maxQuestions || 50)) { toast.error("Max questions reached"); return }
    setQuestions([...questions, { id: `q_${Date.now()}`, question: "", options: ["", "", "", ""], correctAnswer: 0, points: config.pointsPerCorrect || 10 }])
  }

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...questions]; (updated[idx] as any)[field] = value; setQuestions(updated)
  }

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions]; updated[qIdx].options[oIdx] = value; setQuestions(updated)
  }

  const removeQuestion = (idx: number) => setQuestions(questions.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!title) { toast.error("Quiz title required"); return }
    if (questions.length === 0) { toast.error("Add at least one question"); return }
    if (isPreview) { toast.info("Save disabled in preview"); return }
    setIsSaving(true)
    try {
      const body = { title, description, questions, settings: { shuffleQuestions: config.shuffleQuestions } }
      const url = editing ? `/api/modules/live-quiz/quizzes/${editing.id}` : `/api/modules/live-quiz/quizzes`
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(`${url}?orgSlug=${orgSlug}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()
      if (json.success) { toast.success(editing ? "Quiz updated" : "Quiz created"); setEditing(null); setTitle(""); setDescription(""); setQuestions([]) }
      else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><HelpCircle className="h-5 w-5" /> Live Quizzes</h3>
        <Button onClick={() => { setEditing(null); setTitle(""); setDescription(""); setQuestions([]); addQuestion() }} className="gap-1"><Plus className="h-4 w-4" />Create Quiz</Button>
      </div>

      {/* Quiz List */}
      {quizzes.length > 0 && !title && (
        <div className="space-y-2">
          {quizzes.map((q) => (
            <Card key={q.id} className="p-4 flex items-center justify-between">
              <div><p className="font-medium">{q.data?.title || q.title}</p><p className="text-xs text-muted-foreground">{q.data?.questions?.length || 0} questions · {q.participantCount || 0} attempts</p></div>
              <div className="flex gap-2">
                <Badge variant={q.isPublished ? "default" : "secondary"}>{q.isPublished ? "Active" : "Draft"}</Badge>
                <Button variant="outline" size="sm" onClick={() => { setEditing(q); setTitle(q.data?.title || ""); setDescription(q.data?.description || ""); setQuestions(q.data?.questions || []) }}>Edit</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Quiz Editor */}
      {(title || questions.length > 0) && (
        <Card className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Quiz Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Tech Trivia Challenge" /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Test your knowledge!" /></div>
          </div>

          <div className="space-y-3">
            <Label>Questions ({questions.length}/{config.maxQuestions || 50})</Label>
            {questions.map((q, qIdx) => (
              <Card key={q.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Q{qIdx + 1}</span></div>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeQuestion(qIdx)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
                <Textarea value={q.question} onChange={(e) => updateQuestion(qIdx, "question", e.target.value)} placeholder="Enter your question..." rows={2} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === oIdx} onChange={() => updateQuestion(qIdx, "correctAnswer", oIdx)} className="shrink-0" />
                      <Input value={opt} onChange={(e) => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} className="text-sm" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Select the radio button next to the correct answer</p>
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Question</Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="gap-1">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editing ? "Update Quiz" : "Create Quiz"}</Button>
            <Button variant="outline" onClick={() => { setTitle(""); setDescription(""); setQuestions([]); setEditing(null) }}>Cancel</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export default LiveQuizAdmin
