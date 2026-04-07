"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Star, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export default function FeedbackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [enjoyedMost, setEnjoyedMost] = useState("")
  const [improvements, setImprovements] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push(`/login?callbackUrl=/events/${slug}/feedback`)
    }
  }, [authStatus, router, slug])

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Please select a rating"); return }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/events/${slug}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: [enjoyedMost, improvements].filter(Boolean).join("\n\n"), isAnonymous }),
      })
      const data = await res.json()
      if (data.success) { setSubmitted(true); toast.success("Thank you for your feedback!") }
      else toast.error(data.message)
    } catch { toast.error("Failed to submit feedback") }
    finally { setIsSubmitting(false) }
  }

  if (authStatus === "loading") return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="text-2xl font-bold">Thank You!</h1>
        <p className="text-muted-foreground">Your feedback helps organizers improve future events.</p>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={cn("h-6 w-6", s <= rating ? "fill-amber-400 text-amber-400" : "text-muted")} />
          ))}
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card className="p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">How was the event?</h1>
          <p className="text-sm text-muted-foreground mt-1">Your feedback helps organizers improve</p>
        </div>

        {/* Star Rating */}
        <div className="text-center space-y-2">
          <Label>Overall Rating *</Label>
          <div className="flex justify-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${s} star${s > 1 ? "s" : ""}`}
                aria-checked={rating === s}
                role="radio"
                className="p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                <Star className={cn("h-8 w-8 transition-colors", (hoverRating || rating) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating] || "Select a rating"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="enjoyed">What did you enjoy most?</Label>
          <Textarea id="enjoyed" value={enjoyedMost} onChange={(e) => setEnjoyedMost(e.target.value)} placeholder="Tell us what you liked..." rows={3} maxLength={1000} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="improvements">What could be improved?</Label>
          <Textarea id="improvements" value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Any suggestions..." rows={3} maxLength={1000} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
          <label htmlFor="anonymous" className="text-sm text-muted-foreground cursor-pointer">Submit anonymously</label>
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Submit Feedback
        </Button>
      </Card>
    </div>
  )
}
