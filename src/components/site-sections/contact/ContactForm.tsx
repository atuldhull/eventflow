"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Send, CheckCircle, Loader2, Mail, Phone, MapPin } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

export function ContactForm({ config, content, siteStyles, isPreview }: SectionProps) {
  const layout = config.layout || "form-info"
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) { toast.error("Please fill in all required fields"); return }
    if (isPreview) { toast.info("Form submission disabled in preview"); return }
    setIsSending(true)
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.success) { setSent(true); toast.success("Message sent!") }
      else toast.error(json.message || "Failed to send")
    } catch { toast.error("Failed to send") }
    finally { setIsSending(false) }
  }

  const formBlock = (
    <motion.div className={layout === "form-only" ? "max-w-xl mx-auto" : "flex-[3]"} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
      {sent ? (
        <div className="text-center py-12"><CheckCircle className="mx-auto h-12 w-12 mb-4" style={{ color: siteStyles.primaryColor }} /><h3 className="text-xl font-bold" style={{ color: siteStyles.textColor }}>Message Sent!</h3><p className="text-sm opacity-60 mt-1" style={{ color: siteStyles.textColor }}>We'll get back to you soon.</p></div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label style={{ color: siteStyles.textColor }}>Name *</Label><Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label style={{ color: siteStyles.textColor }}>Email *</Label><Input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label style={{ color: siteStyles.textColor }}>Subject</Label><Input placeholder="What's this about?" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="space-y-1.5"><Label style={{ color: siteStyles.textColor }}>Message *</Label><Textarea placeholder="Your message..." rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <Button onClick={handleSubmit} disabled={isSending} className="w-full sm:w-auto gap-2" style={{ backgroundColor: siteStyles.primaryColor }}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Message
          </Button>
        </div>
      )}
    </motion.div>
  )

  const infoBlock = (
    <motion.div className="flex-[2] space-y-6" initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
      <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: siteStyles.primaryColor + "08", borderRadius: siteStyles.borderRadius }}>
        {content.email && <a href={`mailto:${content.email}`} className="flex items-center gap-3 text-sm hover:opacity-80" style={{ color: siteStyles.textColor }}><Mail className="h-5 w-5 shrink-0" style={{ color: siteStyles.primaryColor }} />{content.email}</a>}
        {content.phone && <a href={`tel:${content.phone}`} className="flex items-center gap-3 text-sm hover:opacity-80" style={{ color: siteStyles.textColor }}><Phone className="h-5 w-5 shrink-0" style={{ color: siteStyles.primaryColor }} />{content.phone}</a>}
        {content.address && <p className="flex items-start gap-3 text-sm opacity-70" style={{ color: siteStyles.textColor }}><MapPin className="h-5 w-5 shrink-0 mt-0.5" style={{ color: siteStyles.primaryColor }} />{content.address}</p>}
      </div>
    </motion.div>
  )

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{content.heading}</motion.h2>}
        {layout === "form-only" ? formBlock : (
          <div className="flex flex-col lg:flex-row gap-12">{formBlock}{infoBlock}</div>
        )}
      </div>
    </section>
  )
}

export default ContactForm
