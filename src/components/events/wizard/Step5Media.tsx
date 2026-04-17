"use client"

import { Plus, Trash2, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { MediaStepProps } from "./shared"

export function Step5Media({ register, faqs, setFaqs, sponsors, setSponsors }: MediaStepProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Cover Image</h3>
        <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed hover:border-primary transition-colors cursor-pointer">
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground mt-2">Drag & drop or click to upload</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP (max 5MB, 16:9 recommended)</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Additional Details</h3>
        <div className="space-y-2"><Label>Rules & Guidelines</Label><Textarea rows={3} placeholder="Event rules, dress code..." {...register("rules")} /></div>
        <div className="space-y-2"><Label>Terms & Conditions</Label><Textarea rows={3} placeholder="Terms participants must agree to..." {...register("termsAndConditions")} /></div>
        <div className="space-y-2"><Label>Refund Policy</Label><Textarea rows={2} placeholder="Refund policy..." {...register("refundPolicy")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Contact Email</Label><Input type="email" {...register("contactEmail")} /></div>
          <div className="space-y-2"><Label>Contact Phone</Label><Input {...register("contactPhone")} /></div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">FAQs</h3>
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between"><Label className="text-xs">Question</Label><Button type="button" variant="ghost" size="icon-sm" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>
            <Input value={faq.question} onChange={(e) => { const u = [...faqs]; u[i] = { ...u[i], question: e.target.value }; setFaqs(u) }} />
            <Label className="text-xs">Answer</Label>
            <Textarea rows={2} value={faq.answer} onChange={(e) => { const u = [...faqs]; u[i] = { ...u[i], answer: e.target.value }; setFaqs(u) }} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setFaqs([...faqs, { question: "", answer: "" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add FAQ</Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Sponsors</h3>
        {sponsors.map((sp, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Sponsor {i + 1}</Label>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSponsors(sponsors.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="Sponsor name" value={sp.name} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], name: e.target.value }; setSponsors(u) }} />
              <Input placeholder="Tier (Title, Gold, Silver)" value={sp.tier} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], tier: e.target.value }; setSponsors(u) }} />
              <Input placeholder="Website URL" value={sp.website} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], website: e.target.value }; setSponsors(u) }} />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setSponsors([...sponsors, { name: "", tier: "GOLD", website: "" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Sponsor</Button>
      </Card>
    </div>
  )
}
