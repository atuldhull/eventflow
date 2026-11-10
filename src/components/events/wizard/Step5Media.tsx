"use client"

import { useRef, useState } from "react"
import { ImageUp, Loader2, Plus, Trash2, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MediaStepProps } from "./shared"
import { Field, WizardSection } from "./Section"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * The cover image: dropped or picked, uploaded through POST /api/upload (which checks the
 * file's own bytes and returns its URL), then saved as the event's coverImage.
 */
function CoverImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError("")
    if (!IMAGE_TYPES.includes(file.type)) { setError("Use a JPG, PNG or WebP image."); return }
    if (file.size > MAX_IMAGE_BYTES) { setError("The image is larger than 5 MB."); return }
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body })
      const json = await res.json()
      const url: string | undefined = json?.data?.url
      if (json.success && url && String(json.data.type || "").startsWith("image/")) {
        onChange(url)
      } else {
        setError(json.success ? "That file isn't an image." : json.message || "Upload failed")
      }
    } catch {
      setError("Upload failed. Check your connection and try again.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const picker = (
    <input
      ref={inputRef}
      id="ev-cover"
      type="file"
      accept={IMAGE_TYPES.join(",")}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => void upload(e.target.files?.[0])}
    />
  )

  return (
    <div className="space-y-2">
      {picker}
      {value ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served by our own route */}
          <img src={value} alt="Cover image preview" className="aspect-video w-full rounded-lg border object-cover" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />} Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={uploading} className="text-muted-foreground hover:text-destructive" onClick={() => onChange("")}>
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files?.[0]) }}
          disabled={uploading}
          aria-describedby="ev-cover-hint"
          className={cn(
            "flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-input bg-raised/50 transition-colors hover:border-foreground/30 disabled:cursor-progress",
            dragging && "border-foreground/40 bg-muted",
          )}
        >
          <span className="text-center">
            {uploading ? <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-hidden /> : <Upload className="mx-auto size-5 text-muted-foreground" aria-hidden />}
            <span className="mt-2 block text-sm text-foreground">{uploading ? "Uploading…" : "Drag & drop or click to upload"}</span>
            <span id="ev-cover-hint" className="mt-0.5 block text-xs text-muted-foreground">JPG, PNG, WebP (max 5MB, 16:9 recommended)</span>
          </span>
        </button>
      )}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}

export function Step5Media({ register, watch, setValue, faqs, setFaqs, sponsors, setSponsors }: MediaStepProps) {
  return (
    <div className="space-y-6">
      <WizardSection title="Cover image" description="Shown at the top of the event page.">
        <CoverImageField value={watch("coverImage") || ""} onChange={(url) => setValue("coverImage", url, { shouldDirty: true })} />
      </WizardSection>

      <WizardSection title="Additional details" description="Rules, terms and who to contact.">
        <Field id="ev-rules" label="Rules & guidelines">
          <Textarea id="ev-rules" rows={3} placeholder="Event rules, dress code..." {...register("rules")} />
        </Field>
        <Field id="ev-terms" label="Terms & conditions">
          <Textarea id="ev-terms" rows={3} placeholder="Terms participants must agree to..." {...register("termsAndConditions")} />
        </Field>
        <Field id="ev-refund" label="Refund policy">
          <Textarea id="ev-refund" rows={2} placeholder="Refund policy..." {...register("refundPolicy")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ev-contact-email" label="Contact email"><Input id="ev-contact-email" type="email" {...register("contactEmail")} /></Field>
          <Field id="ev-contact-phone" label="Contact phone"><Input id="ev-contact-phone" type="tel" {...register("contactPhone")} /></Field>
        </div>
      </WizardSection>

      <WizardSection
        title="FAQs"
        description="Answers to what people usually ask."
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}>
            <Plus /> Add FAQ
          </Button>
        }
      >
        {faqs.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No FAQs yet.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-lg border">
            {faqs.map((faq, i) => (
              <li key={i} className="space-y-4 px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">FAQ {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Remove FAQ ${i + 1}`} onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
                <Field id={`faq-q-${i}`} label="Question">
                  <Input id={`faq-q-${i}`} value={faq.question} onChange={(e) => { const u = [...faqs]; u[i] = { ...u[i], question: e.target.value }; setFaqs(u) }} />
                </Field>
                <Field id={`faq-a-${i}`} label="Answer">
                  <Textarea id={`faq-a-${i}`} rows={2} value={faq.answer} onChange={(e) => { const u = [...faqs]; u[i] = { ...u[i], answer: e.target.value }; setFaqs(u) }} />
                </Field>
              </li>
            ))}
          </ul>
        )}
      </WizardSection>

      <WizardSection
        title="Sponsors"
        description="Listed on the event page."
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setSponsors([...sponsors, { name: "", tier: "GOLD", website: "" }])}>
            <Plus /> Add sponsor
          </Button>
        }
      >
        {sponsors.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No sponsors yet.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-lg border">
            {sponsors.map((sp, i) => (
              <li key={i} className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sponsor {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Remove sponsor ${i + 1}`} onClick={() => setSponsors(sponsors.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input aria-label="Sponsor name" placeholder="Sponsor name" value={sp.name} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], name: e.target.value }; setSponsors(u) }} />
                  <Input aria-label="Sponsor tier" placeholder="Tier (Title, Gold, Silver)" value={sp.tier} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], tier: e.target.value }; setSponsors(u) }} />
                  <Input aria-label="Sponsor website" type="url" placeholder="Website URL" value={sp.website} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], website: e.target.value }; setSponsors(u) }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </WizardSection>
    </div>
  )
}
