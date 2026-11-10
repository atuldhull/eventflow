"use client"

import { useState } from "react"
import { Mail, MapPin, Clock, Loader2, CircleCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Container, PageIntro } from "@/components/marketing/layout"
import { toast } from "sonner"

const SUBJECTS = [
  { value: "general", label: "General Inquiry" },
  { value: "support", label: "Technical Support" },
  { value: "enterprise", label: "Enterprise Plans" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "other", label: "Other" },
]

const DETAILS: { icon: typeof Mail; label: string; value: string; href?: string }[] = [
  { icon: Mail, label: "Email", value: "support@eventflow.com", href: "mailto:support@eventflow.com" },
  { icon: MapPin, label: "Address", value: "Bangalore, India" },
  { icon: Clock, label: "Hours", value: "Mon-Fri, 9 AM — 6 PM IST" },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all required fields")
      return
    }
    setIsSending(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setSent(true)
        toast.success("Message sent! We'll get back to you soon.")
      } else {
        toast.error(json.message || "Failed to send message")
      }
    } catch {
      toast.error("Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <PageIntro title="Get in touch" description="Have a question or need help? We'd love to hear from you." />

      <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-20">
        <section aria-labelledby="contact-details-heading">
          <h2 id="contact-details-heading" className="text-[15px] font-semibold">Contact details</h2>
          <dl className="mt-4 divide-y divide-rule border-y border-rule">
            {DETAILS.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-3 py-4">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <div className="min-w-0">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-[15px]">
                    {href ? <a href={href} className="underline-offset-4 hover:text-brand hover:underline">{value}</a> : value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="contact-form-heading" className="rounded-lg border bg-card p-5 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-start py-6" role="status">
              <CircleCheck className="size-6 text-positive" strokeWidth={1.75} aria-hidden />
              <h2 id="contact-form-heading" className="mt-4 text-lg font-semibold">Message sent</h2>
              <p className="mt-1 text-sm text-muted-foreground">We&apos;ll get back to you within 24 hours.</p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setSent(false)
                  setForm({ name: "", email: "", subject: "", message: "" })
                }}
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
              className="space-y-5"
            >
              <div>
                <h2 id="contact-form-heading" className="text-lg font-semibold">Send us a message</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">Fields marked * are required.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Name *</Label>
                  <Input id="contact-name" autoComplete="name" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email *</Label>
                  <Input id="contact-email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-subject">Subject</Label>
                <Select items={SUBJECTS} value={form.subject || null} onValueChange={(v) => setForm({ ...form, subject: v || "" })}>
                  <SelectTrigger id="contact-subject" className="w-full data-[size=default]:h-9">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-message">Message *</Label>
                <Textarea id="contact-message" placeholder="How can we help?" rows={5} className="min-h-32" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto sm:px-6" disabled={isSending}>
                {isSending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Sending…</> : "Send message"}
              </Button>
            </form>
          )}
        </section>
      </Container>
    </>
  )
}
