"use client"

import { useState } from "react"
import { Mail, Phone, MapPin, Clock, Loader2, CheckCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { toast } from "sonner"

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
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center">Get in Touch</h1>
        <p className="text-muted-foreground text-center mt-2">Have a question or need help? We'd love to hear from you.</p>

        <div className="grid gap-8 lg:grid-cols-5 mt-12">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              {[
                { icon: Mail, label: "Email", value: "support@eventflow.com" },
                { icon: Phone, label: "Phone", value: "+91 XXXXX XXXXX" },
                { icon: MapPin, label: "Address", value: "Bangalore, India" },
                { icon: Clock, label: "Hours", value: "Mon-Fri, 9 AM — 6 PM IST" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="lg:col-span-3 p-6 space-y-4">
            {sent ? (
              <div className="text-center py-12">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">Message Sent!</h3>
                <p className="text-sm text-muted-foreground mt-1">We'll get back to you within 24 hours.</p>
                <Button variant="outline" className="mt-4" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }) }}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Name *</Label><Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Email *</Label><Input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v || "" })}>
                    <SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Inquiry</SelectItem>
                      <SelectItem value="support">Technical Support</SelectItem>
                      <SelectItem value="enterprise">Enterprise Plans</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Message *</Label><Textarea placeholder="How can we help?" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
                <Button className="w-full" onClick={handleSubmit} disabled={isSending}>
                  {isSending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</> : "Send Message"}
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
