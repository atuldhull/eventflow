"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { HandHeart, Clock, Users, Tag, CheckCircle2, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Position {
  id: string
  data: {
    title: string; description: string; event?: string; timeCommitment: string
    spotsTotal: number; spotsFilled: number; skills: string[]; deadline?: string
  }
}

const SAMPLE_POSITIONS: Position[] = [
  { id: "vp1", data: { title: "Stage Manager for Tech Fest 2026", description: "Coordinate backstage activities, manage speakers, and ensure smooth session transitions.", event: "Tech Fest 2026", timeCommitment: "Full Day", spotsTotal: 3, spotsFilled: 1, skills: ["Event Management", "Communication"] } },
  { id: "vp2", data: { title: "Photography Volunteer", description: "Capture event photos for social media and post-event content.", event: "Tech Fest 2026", timeCommitment: "4 hours", spotsTotal: 5, spotsFilled: 3, skills: ["Photography", "Photo Editing"] } },
  { id: "vp3", data: { title: "Social Media Support", description: "Live-tweet and post updates during events. Help with content creation.", timeCommitment: "Ongoing", spotsTotal: 10, spotsFilled: 4, skills: ["Social Media", "Content Writing"] } },
]

export function VolunteerSignupModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [positions, setPositions] = useState<Position[]>([])
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Application form
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formWhy, setFormWhy] = useState("")
  const [formExperience, setFormExperience] = useState("")

  useEffect(() => {
    if (isPreview) { setPositions(SAMPLE_POSITIONS); setIsLoading(false); return }
    async function fetch_() {
      try {
        const res = await fetch(`/api/modules/volunteer-signup/positions?orgSlug=${orgSlug}`)
        const json = await res.json()
        if (json.success) setPositions(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, isPreview])

  const handleSubmit = async () => {
    if (!formName || !formEmail) { toast.error("Name and email are required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/modules/volunteer-signup/positions/${selectedPosition!.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, email: formEmail, phone: formPhone, why: formWhy, experience: formExperience, orgSlug }),
      })
      const json = await res.json()
      if (json.success) { setIsSubmitted(true) }
      else toast.error(json.message)
    } catch { toast.error("Failed to submit") } finally { setIsSubmitting(false) }
  }

  const resetForm = () => {
    setSelectedPosition(null)
    setIsSubmitted(false)
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormWhy(""); setFormExperience("")
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  // Thank you state
  if (isSubmitted) {
    return (
      <motion.div className="text-center py-12 space-y-4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
        <h3 className="text-xl font-bold">Application Submitted!</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">Thank you for applying. The organizer will review your application and contact you soon.</p>
        <Button variant="outline" onClick={resetForm}>Browse More Positions</Button>
      </motion.div>
    )
  }

  // Application form
  if (selectedPosition) {
    const d = selectedPosition.data
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <button onClick={() => setSelectedPosition(null)} className="text-sm text-muted-foreground hover:underline flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Back to Positions</button>
        <div>
          <h3 className="text-lg font-bold">{d.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            {d.event && <span>{d.event}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.timeCommitment}</span>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <h4 className="font-semibold">Apply for this Position</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Your full name" /></div>
            <div className="space-y-1"><Label className="text-xs">Email *</Label><Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="your@email.com" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+91 9876543210" /></div>
          <div className="space-y-1"><Label className="text-xs">Why do you want to volunteer?</Label><Textarea value={formWhy} onChange={e => setFormWhy(e.target.value)} placeholder="Tell us about your motivation..." rows={3} /></div>
          <div className="space-y-1"><Label className="text-xs">Relevant experience</Label><Textarea value={formExperience} onChange={e => setFormExperience(e.target.value)} placeholder="Any relevant skills or experience..." rows={3} /></div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Submit Application</Button>
        </Card>
      </div>
    )
  }

  // Position listing
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2"><HandHeart className="h-5 w-5" /> Volunteer Opportunities</h3>
      {positions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No open positions right now</p>
      ) : (
        <div className="space-y-4">
          {positions.map((pos, idx) => {
            const d = pos.data
            const isFull = d.spotsFilled >= d.spotsTotal
            const pct = Math.min((d.spotsFilled / d.spotsTotal) * 100, 100)
            if (isFull && !config.showFilledPositions) return null
            return (
              <motion.div key={pos.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className={`p-5 space-y-3 ${isFull ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{d.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                    </div>
                    <Button size="sm" disabled={isFull} onClick={() => !isFull && setSelectedPosition(pos)}>
                      {isFull ? "Full" : "Apply"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {d.event && <span className="flex items-center gap-1">📅 {d.event}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.timeCommitment}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{d.spotsFilled}/{d.spotsTotal} spots filled</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div className={`h-full rounded-full ${isFull ? "bg-red-400" : "bg-primary"}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: idx * 0.05 }} />
                  </div>
                  {d.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">{d.skills.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default VolunteerSignupModule
