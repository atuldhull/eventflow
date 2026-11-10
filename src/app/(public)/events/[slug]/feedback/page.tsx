"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Star, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

import { Skeleton } from "@/components/ui/skeleton"
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

  if (authStatus === "loading") {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 py-12 sm:py-16" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-72" />
        <Skeleton className="mt-8 h-[420px] rounded-lg" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 py-16 text-center sm:py-24">
        <CheckCircle className="mx-auto size-8 text-positive" strokeWidth={1.75} aria-hidden />
        <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">Thank you!</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Your feedback helps organizers improve future events.</p>
        <div className="mt-5 flex justify-center gap-1" aria-label={`Your rating: ${rating} out of 5`} role="img">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={cn("size-6", s <= rating ? "fill-current text-foreground" : "text-border")} aria-hidden />
          ))}
        </div>
        <Button variant="outline" className="mt-8" onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 py-10 sm:py-16">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">How was the event?</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Your feedback helps organizers improve</p>

      <div className="mt-8 space-y-6 rounded-lg border bg-card p-5 sm:p-6">
        {/* Star rating */}
        <div>
          <p id="rating-label" className="text-sm font-medium">Overall rating <span className="text-muted-foreground">*</span></p>
          <div className="mt-3 flex items-center gap-4">
            <div className="-ml-1.5 flex gap-0.5" role="radiogroup" aria-labelledby="rating-label">
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
                  className="press flex size-11 items-center justify-center rounded-md transition-colors hover:bg-accent"
                >
                  <Star className={cn("size-7 transition-colors", (hoverRating || rating) >= s ? "fill-current text-foreground" : "text-input")} strokeWidth={1.5} />
                </button>
              ))}
            </div>
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating] || "Select a rating"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="enjoyed">What did you enjoy most?</Label>
          <Textarea id="enjoyed" value={enjoyedMost} onChange={(e) => setEnjoyedMost(e.target.value)} placeholder="Tell us what you liked..." rows={3} maxLength={1000} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="improvements">What could be improved?</Label>
          <Textarea id="improvements" value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Any suggestions..." rows={3} maxLength={1000} />
        </div>

        <div className="flex min-h-9 items-center gap-2.5">
          <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
          <label htmlFor="anonymous" className="cursor-pointer text-sm text-muted-foreground">Submit anonymously</label>
        </div>

        <Button className="h-11 w-full gap-2 text-[15px]" onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Submit feedback
        </Button>
      </div>
    </div>
  )
}
