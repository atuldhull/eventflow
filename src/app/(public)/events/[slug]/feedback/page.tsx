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
      <div className="mx-auto w-full max-w-[640px] px-5 py-12 sm:py-16" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-72" />
        <Skeleton className="mt-8 h-[460px] rounded-3xl" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="relative isolate overflow-hidden">
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto w-full max-w-[600px] px-5 py-16 text-center sm:py-28">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lemon text-lemon-ink">
            <CheckCircle className="size-7" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="font-display mt-6 text-[44px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[64px]">
            <span className="relative z-0 inline-block px-[0.06em]">
              <span aria-hidden className="absolute -inset-x-[0.04em] top-[0.1em] bottom-[0.02em] -z-10 -rotate-[1.5deg] rounded-[0.16em] bg-lemon" />
              <span className="relative text-lemon-ink">Thank you!</span>
            </span>
          </h1>
          <p className="mt-5 text-[17px] text-muted-foreground">Your feedback helps organizers improve future events.</p>
          <div className="mt-7 flex justify-center gap-1.5" aria-label={`Your rating: ${rating} out of 5`} role="img">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={cn("size-8", s <= rating ? "fill-lemon text-lemon-ink dark:text-lemon" : "text-border")} strokeWidth={1.5} aria-hidden />
            ))}
          </div>
          <Button variant="outline" className="mt-10 h-11 px-6" onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
        </div>
      </div>
    )
  }

  const shown = hoverRating || rating

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="fx-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" />
      <div aria-hidden className="pointer-events-none absolute top-[-140px] right-[-60px] -z-10 size-[420px] rounded-full bg-lavender/20 blur-[110px]" />
      <div className="mx-auto w-full max-w-[640px] px-5 py-10 sm:py-16">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
          Feedback
        </p>
        <h1 className="font-display mt-3 text-[38px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[56px]">How was the event?</h1>
        <p className="mt-3 text-[16px] text-muted-foreground">Your feedback helps organizers improve</p>

        <div className="mt-8 space-y-7 rounded-3xl border bg-card p-5 sm:p-7">
          {/* Star rating: five big tiles, lit lemon up to the chosen one */}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p id="rating-label" className="text-sm font-medium">Overall rating <span className="text-muted-foreground">*</span></p>
              <p className="font-display text-[18px] font-bold tracking-[-0.02em]" aria-live="polite">
                {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating] || <span className="font-sans text-[13px] font-normal text-muted-foreground">Select a rating</span>}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-labelledby="rating-label">
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
                  className={cn(
                    "press flex aspect-square min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5",
                    shown >= s ? "border-lemon bg-lemon text-lemon-ink" : "border-border bg-transparent text-muted-foreground hover:border-input",
                  )}
                >
                  <Star className={cn("size-7 transition-transform duration-200 sm:size-8", shown >= s && "scale-110 fill-current")} strokeWidth={1.5} />
                  <span className="font-display text-[13px] font-bold tabular-nums">{s}</span>
                </button>
              ))}
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

          <div className="flex min-h-11 items-center gap-2.5">
            <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
            <label htmlFor="anonymous" className="cursor-pointer text-sm text-muted-foreground">Submit anonymously</label>
          </div>

          <Button
            className="h-12 w-full gap-2 bg-lemon text-[15px] font-semibold text-lemon-ink hover:bg-lemon hover:shadow-[0_12px_40px_-10px_var(--lemon)] disabled:opacity-40"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Submit feedback
          </Button>
        </div>
      </div>
    </div>
  )
}
