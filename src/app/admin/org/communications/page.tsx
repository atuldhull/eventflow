"use client"

import { useState } from "react"
import { Send, History, Megaphone, FileText, Clock, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"

export default function CommunicationsPage() {
  const { currentOrganizationId } = useRBAC()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [recipientType, setRecipientType] = useState("all")
  const [isSending, setIsSending] = useState(false)

  const mergeTags = [
    { tag: "{{participant_name}}", label: "Name" },
    { tag: "{{participant_email}}", label: "Email" },
    { tag: "{{event_title}}", label: "Event" },
    { tag: "{{registration_number}}", label: "Reg #" },
    { tag: "{{ticket_number}}", label: "Ticket #" },
  ]

  const insertTag = (tag: string) => {
    setBody((prev) => prev + tag)
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || !currentOrganizationId) {
      toast.error("Subject and body are required")
      return
    }

    setIsSending(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/communications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientFilter: { type: recipientType },
          subject,
          body: `<div>${body.replace(/\n/g, "<br/>")}</div>`,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Email queued for ${data.data.queued} recipients`)
        setSubject("")
        setBody("")
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error("Failed to send")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        description="Send emails, post announcements, and manage notifications"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Communications" },
        ]}
      />

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose" className="gap-1"><Send className="h-3.5 w-3.5" /> Compose</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History className="h-3.5 w-3.5" /> Sent</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1"><Megaphone className="h-3.5 w-3.5" /> Announcements</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-medium">Recipients</h3>
            <Select value={recipientType} onValueChange={(v) => setRecipientType(v || "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Participants</SelectItem>
                <SelectItem value="by_event">By Event</SelectItem>
                <SelectItem value="by_status">By Registration Status</SelectItem>
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-medium">Email Content</h3>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input placeholder="Email subject..." value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <div className="flex gap-1">
                  {mergeTags.map((mt) => (
                    <button
                      key={mt.tag}
                      onClick={() => insertTag(mt.tag)}
                      className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium hover:bg-primary/10 transition-colors"
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea placeholder="Write your message..." rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleSend} disabled={isSending} className="gap-2">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </Button>
            <Button variant="outline">Save as Draft</Button>
          </div>
        </TabsContent>

        {/* Sent History */}
        <TabsContent value="history" className="mt-4">
          <Card className="p-8 text-center text-muted-foreground">
            <History className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="font-medium">No sent messages yet</p>
            <p className="text-sm mt-1">Your sent communications will appear here.</p>
          </Card>
        </TabsContent>

        {/* Announcements */}
        <TabsContent value="announcements" className="mt-4">
          <Card className="p-8 text-center text-muted-foreground">
            <Megaphone className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm mt-1">Post announcements to event pages.</p>
            <PermissionGate permission={PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT}>
              <Button className="mt-3">New Announcement</Button>
            </PermissionGate>
          </Card>
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="mt-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Email Templates</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: "Event Reminder", desc: "Remind participants about upcoming events" },
                { name: "Schedule Change", desc: "Notify about date/time/venue changes" },
                { name: "Event Cancelled", desc: "Cancellation notice with refund info" },
                { name: "Thank You", desc: "Post-event thank you message" },
                { name: "Feedback Request", desc: "Ask for event feedback" },
                { name: "Certificate Ready", desc: "Certificate download notification" },
              ].map((t) => (
                <div key={t.name} className="rounded-lg border p-3 hover:border-primary transition-colors cursor-pointer">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
