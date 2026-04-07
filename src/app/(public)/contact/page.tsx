import type { Metadata } from "next"
import { Mail, Phone, MapPin, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export const metadata: Metadata = {
  title: "Contact Us | EventFlow",
  description: "Get in touch with EventFlow. Have questions? We'd love to help.",
}

export default function ContactPage() {
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Name *</Label><Input placeholder="Your name" /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" placeholder="you@example.com" /></div>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
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
            <div className="space-y-2"><Label>Message *</Label><Textarea placeholder="How can we help?" rows={5} /></div>
            <Button className="w-full">Send Message</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
