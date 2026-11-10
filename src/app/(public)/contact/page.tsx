"use client"

import { useState } from "react"
import { Mail, MapPin, Clock, Loader2, CircleCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Container } from "@/components/marketing/layout"
import { Reveal, WordReveal } from "@/components/marketing/fx"
import { Highlighter, Kicker } from "@/components/marketing/kit"
import { heroTitle } from "@/components/marketing/styles"
import { cn } from "@/lib/utils"
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
  { icon: Clock, label: "Hours", value: "Mon-Fri, 9 AM to 6 PM IST" },
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
      <header className="relative -mt-16 overflow-hidden pt-16">
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <Container className="pt-14 pb-12 sm:pt-20 sm:pb-16">
          <Kicker>Contact</Kicker>
          <h1 className={cn(heroTitle, "mt-4 max-w-[14ch]")}>
            <WordReveal text="Get" /> <Highlighter delay={0.3}>in touch</Highlighter>
          </h1>
          <Reveal delay={0.3} y={16}>
            <p className="mt-6 max-w-[50ch] text-[17px] leading-relaxed text-muted-foreground">Have a question or need help? We&apos;d love to hear from you.</p>
          </Reveal>
        </Container>
      </header>

      <Container className="grid gap-5 pb-20 sm:pb-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-stretch">
        {/* the details on an always-dark panel, the address book of the company */}
        <Reveal className="h-full">
          <section aria-labelledby="contact-details-heading" className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-charcoal p-7 text-white sm:p-9 dark:border dark:border-white/10">
            <div aria-hidden className="pointer-events-none absolute -right-32 -bottom-32 size-[360px] rounded-full bg-lavender/30 blur-[100px]" />
            <h2 id="contact-details-heading" className="relative flex items-center gap-2 text-sm font-semibold text-lemon">
              <span className="h-[2px] w-6 rounded-full bg-lavender" aria-hidden />
              Contact details
            </h2>
            <dl className="relative mt-8 flex flex-1 flex-col gap-8">
              {DETAILS.map(({ icon: Icon, label, value, href }, i) => (
                <div key={label} className={cn(i === 0 && "flex-1")}>
                  <dt className="flex items-center gap-2 text-[13px] text-white/55">
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                    {label}
                  </dt>
                  <dd className={cn("font-display mt-2 tracking-[-0.03em] break-words", i === 0 ? "text-[24px] leading-[1.05] font-extrabold sm:text-[34px]" : "text-[22px] font-bold")}>
                    {href ? (
                      <a href={href} className="underline decoration-lemon decoration-2 underline-offset-[6px] transition-colors hover:text-lemon">
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>


        <section aria-labelledby="contact-form-heading" className="rounded-[28px] border bg-card p-6 sm:p-9">
          {sent ? (
            <div className="flex flex-col items-start py-6" role="status">
              <span className="flex size-14 items-center justify-center rounded-full bg-lemon text-lemon-ink"><CircleCheck className="size-7" strokeWidth={2} aria-hidden /></span>
              <h2 id="contact-form-heading" className="font-display mt-4 text-[32px] leading-none font-extrabold tracking-[-0.04em]">Message sent</h2>
              <p className="mt-3 text-[16px] text-muted-foreground">We&apos;ll get back to you within 24 hours.</p>
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
                <h2 id="contact-form-heading" className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.035em] sm:text-[32px]">Send us a message</h2>
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
              <Button type="submit" size="lg" className="h-12 w-full text-[15px] sm:w-auto sm:px-7" disabled={isSending}>
                {isSending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Sending…</> : "Send message"}
              </Button>
            </form>
          )}
        </section>
      </Container>
    </>
  )
}
