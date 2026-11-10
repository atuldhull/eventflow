"use client"

import { useCallback, useEffect, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Send, History, Megaphone, Loader2, FileText, MoreHorizontal, Plus, Pin } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel } from "@/lib/status-tone"
import { useRBAC } from "@/hooks/useRBAC"

type RecipientType = "all" | "by_event" | "by_status"

interface EventOption { id: string; title: string; startDate: string; status: string }
interface Draft {
  id: string
  subject: string
  body: string
  /** missing on a draft saved before recipients were chosen */
  recipientFilter?: { type: RecipientType; eventId?: string; statuses?: string[] }
  updatedAt: string
  updatedByName?: string
}
interface SentRow { id: string; subject: string; recipients: number | null; audience: string | null; sentBy: string; sentAt: string }
interface Announcement {
  id: string
  eventId: string
  title: string
  content: string
  priority: string
  isPinned: boolean
  publishedAt: string | null
  createdAt: string
  event: { title: string }
  createdBy: { name: string }
}

const RECIPIENTS: Record<RecipientType, string> = {
  all: "All participants",
  by_event: "Participants of one event",
  by_status: "By registration status",
}

const STATUS_CHOICES = ["CONFIRMED", "CHECKED_IN", "PENDING", "WAITLISTED", "NO_SHOW", "CANCELLED"] as const

const MERGE_TAGS = [
  { tag: "{{participant_name}}", label: "Name" },
  { tag: "{{participant_email}}", label: "Email" },
  { tag: "{{event_title}}", label: "Event" },
  { tag: "{{registration_number}}", label: "Reg #" },
  { tag: "{{organizer_name}}", label: "Organizer" },
]

const EMAIL_TEMPLATES = [
  {
    name: "Event reminder",
    desc: "Remind participants about upcoming events",
    subject: "Reminder: {{event_title}} is coming up",
    body: "Hi {{participant_name}},\n\nThis is a reminder that {{event_title}} is coming up soon. Keep your registration number {{registration_number}} handy for check-in.\n\nSee you there,\n{{organizer_name}}",
  },
  {
    name: "Schedule change",
    desc: "Notify about date, time or venue changes",
    subject: "Update to {{event_title}}",
    body: "Hi {{participant_name}},\n\nThere has been a change to {{event_title}}:\n\n[Describe what changed: the new date, time or venue]\n\nYour registration ({{registration_number}}) stays valid.\n\n{{organizer_name}}",
  },
  {
    name: "Event cancelled",
    desc: "Cancellation notice with refund info",
    subject: "{{event_title}} has been cancelled",
    body: "Hi {{participant_name}},\n\nWe're sorry to tell you that {{event_title}} has been cancelled.\n\n[Explain refunds: how and when they will be made]\n\n{{organizer_name}}",
  },
  {
    name: "Thank you",
    desc: "Post-event thank you message",
    subject: "Thank you for joining {{event_title}}",
    body: "Hi {{participant_name}},\n\nThank you for being part of {{event_title}}. We hope you enjoyed it.\n\n{{organizer_name}}",
  },
  {
    name: "Feedback request",
    desc: "Ask for event feedback",
    subject: "How was {{event_title}}?",
    body: "Hi {{participant_name}},\n\nWe'd love to hear what you thought of {{event_title}}. Your feedback helps us make the next one better.\n\n[Add the feedback link]\n\n{{organizer_name}}",
  },
  {
    name: "Certificate ready",
    desc: "Certificate download notification",
    subject: "Your certificate for {{event_title}} is ready",
    body: "Hi {{participant_name}},\n\nYour certificate for {{event_title}} is ready. Download it from the Certificates page of your EventFlow dashboard.\n\n{{organizer_name}}",
  },
]

const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

function audienceText(filter: Draft["recipientFilter"], events: EventOption[]) {
  if (!filter) return "No recipients chosen"
  if (filter.type === "by_event") return events.find((e) => e.id === filter.eventId)?.title ?? "One event"
  if (filter.type === "by_status") return (filter.statuses ?? []).map((s) => statusLabel(s)).join(", ") || "By status"
  return RECIPIENTS.all
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: Boolean(json.success), message: (json.message as string) || "Something went wrong", data: json.data }
}

function EventSelect({ id, value, onChange, events, placeholder = "Choose an event" }: {
  id: string; value: string; onChange: (v: string) => void; events: EventOption[]; placeholder?: string
}) {
  return (
    <Select value={value || null} onValueChange={(v) => onChange(v || "")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>
          {(v: string | null) => events.find((e) => e.id === v)?.title ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function AnnouncementsPanel({ orgId, events }: { orgId: string; events: EventOption[] }) {
  const { can } = useRBAC()
  const canPost = can(PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT)
  const [items, setItems] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<null | "draft" | "post">(null)
  const [form, setForm] = useState({ eventId: "", title: "", content: "", priority: "NORMAL", isPinned: false, sendAsEmail: false })
  const [publishTarget, setPublishTarget] = useState<Announcement | null>(null)
  const [publishEmail, setPublishEmail] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [rowBusy, setRowBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${orgId}/announcements`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) setItems(json.data)
        else toast.error(json.message || "Failed to load announcements")
      } catch {
        if (!cancelled) toast.error("Failed to load announcements")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [orgId, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  const create = async (publish: boolean) => {
    if (!form.eventId || !form.title.trim() || !form.content.trim()) {
      toast.error("Choose an event and write a title and message")
      return
    }
    setBusy(publish ? "post" : "draft")
    const r = await call(`/api/admin/org/${orgId}/announcements`, "POST", { ...form, publish })
    setBusy(null)
    if (!r.ok) { toast.error(r.message); return }
    toast.success(r.message)
    setOpen(false)
    setForm({ eventId: "", title: "", content: "", priority: "NORMAL", isPinned: false, sendAsEmail: false })
    reload()
  }

  const patch = async (a: Announcement, body: unknown) => {
    setRowBusy(true)
    const r = await call(`/api/admin/org/${orgId}/announcements/${a.id}`, "PATCH", body)
    setRowBusy(false)
    if (!r.ok) { toast.error(r.message); return false }
    toast.success(r.message)
    reload()
    return true
  }

  const remove = async (a: Announcement) => {
    setRowBusy(true)
    const r = await call(`/api/admin/org/${orgId}/announcements/${a.id}`, "DELETE")
    setRowBusy(false)
    if (!r.ok) { toast.error(r.message); return }
    toast.success(r.message)
    setDeleteTarget(null)
    reload()
  }

  const columns: ColumnDef<Announcement, unknown>[] = [
    {
      accessorKey: "title",
      header: "Announcement",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium">
            {row.original.isPinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pinned" />}
            <span className="truncate">{row.original.title}</span>
          </p>
          <p className="truncate text-[13px] text-muted-foreground">{row.original.event.title}</p>
        </div>
      ),
      meta: { className: "min-w-[220px] max-w-[360px]" },
    },
    {
      id: "state",
      header: "Status",
      cell: ({ row }) =>
        row.original.publishedAt ? <Pill tone="positive">Published</Pill> : <Pill tone="neutral">Draft</Pill>,
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ getValue }) => {
        const p = getValue() as string
        return <Pill tone={p === "URGENT" ? "negative" : p === "HIGH" ? "warning" : "neutral"}>{statusLabel(p)}</Pill>
      },
    },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{fmtDateTime(row.original.publishedAt ?? row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: "right", className: "w-12" },
      cell: ({ row }) => {
        const a = row.original
        if (!canPost) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.title}`} className="text-muted-foreground" disabled={rowBusy} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!a.publishedAt && (
                <DropdownMenuItem onClick={() => { setPublishEmail(false); setPublishTarget(a) }}>Publish now</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => patch(a, { action: "pin", isPinned: !a.isPinned })}>
                {a.isPinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(a)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted-foreground">Updates for an event&apos;s confirmed participants, as a notification and, if you choose, an email.</p>
        <PermissionGate permission={PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT}>
          <Button onClick={() => setOpen(true)} disabled={events.length === 0} className="max-sm:w-full"><Plus /> New announcement</Button>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description={events.length === 0 ? "Publish an event first, then post updates to its participants." : "Post an update to an event's participants."}
            className="border-0 py-6"
          />
        }
      />

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={(e) => { e.preventDefault(); create(true) }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>New announcement</DialogTitle>
              <DialogDescription>Confirmed and checked-in participants of the event are notified when you post.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="ann-event">Event</Label>
              <EventSelect id="ann-event" value={form.eventId} onChange={(v) => setForm({ ...form, eventId: v })} events={events} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ann-title">Title</Label>
              <Input id="ann-title" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ann-content">Message</Label>
              <Textarea id="ann-content" rows={5} maxLength={10000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ann-priority">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v || "NORMAL" })}>
                  <SelectTrigger id="ann-priority" className="w-full">
                    <SelectValue>{(v: string) => statusLabel(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{statusLabel(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex min-h-9 w-full items-center justify-between gap-3">
                  <Label htmlFor="ann-pin">Pin to top</Label>
                  <Switch id="ann-pin" checked={form.isPinned} onCheckedChange={(v) => setForm({ ...form, isPinned: Boolean(v) })} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div>
                <Label htmlFor="ann-email">Also send by email</Label>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Each participant gets the message in their inbox too.</p>
              </div>
              <Switch id="ann-email" checked={form.sendAsEmail} onCheckedChange={(v) => setForm({ ...form, sendAsEmail: Boolean(v) })} />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" disabled={busy !== null} />}>Cancel</DialogClose>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => create(false)}>
                {busy === "draft" && <Loader2 className="animate-spin" />} Save as draft
              </Button>
              <Button type="submit" disabled={busy !== null}>
                {busy === "post" ? <Loader2 className="animate-spin" /> : <Send />} Post
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={publishTarget !== null} onOpenChange={(o) => { if (!o && !rowBusy) setPublishTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish “{publishTarget?.title}”?</DialogTitle>
            <DialogDescription>Confirmed participants of {publishTarget?.event.title} are notified now.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <Label htmlFor="pub-email">Also send by email</Label>
            <Switch id="pub-email" checked={publishEmail} onCheckedChange={(v) => setPublishEmail(Boolean(v))} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={rowBusy} />}>Cancel</DialogClose>
            <Button
              disabled={rowBusy}
              onClick={async () => {
                if (publishTarget && (await patch(publishTarget, { action: "publish", sendAsEmail: publishEmail }))) setPublishTarget(null)
              }}
            >
              {rowBusy && <Loader2 className="animate-spin" />} Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o && !rowBusy) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.title}”?</DialogTitle>
            <DialogDescription>Notifications already sent stay in participants&apos; inboxes.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={rowBusy} />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={rowBusy} onClick={() => deleteTarget && remove(deleteTarget)}>
              {rowBusy && <Loader2 className="animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CommunicationsPage() {
  const { currentOrganizationId, can } = useRBAC()
  const canSend = can(PERMISSIONS.COMMUNICATION_SEND_EMAIL)
  const [tab, setTab] = useState("compose")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  // No default audience: the sender picks one, so nobody emails everyone by accident.
  const [recipientType, setRecipientType] = useState<RecipientType | "">("")
  const [eventId, setEventId] = useState("")
  const [statuses, setStatuses] = useState<string[]>(["CONFIRMED", "CHECKED_IN"])
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [events, setEvents] = useState<EventOption[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [sent, setSent] = useState<SentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDraftTarget, setDeleteDraftTarget] = useState<Draft | null>(null)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/communications`)
      const json = await res.json()
      if (json.success) {
        setEvents(json.data.events)
        setDrafts(json.data.drafts)
        setSent(json.data.sent)
      } else {
        toast.error(json.message || "Failed to load communications")
      }
    } catch {
      toast.error("Failed to load communications")
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const insertTag = (tag: string) => setBody((prev) => prev + tag)
  /** The chosen audience, or undefined while none is chosen (a draft may be saved without one). */
  const recipientFilter = () =>
    recipientType
      ? {
          type: recipientType,
          ...(recipientType === "by_event" ? { eventId } : {}),
          ...(recipientType === "by_status" ? { statuses } : {}),
        }
      : undefined
  const resetComposer = () => {
    setSubject("")
    setBody("")
    setRecipientType("")
    setEventId("")
    setStatuses(["CONFIRMED", "CHECKED_IN"])
    setDraftId(null)
  }
  const recipientsReady =
    recipientType === "all" || (recipientType === "by_event" && !!eventId) || (recipientType === "by_status" && statuses.length > 0)

  // Send now: check, count who it reaches, and ask before anything goes out.
  const [confirmSend, setConfirmSend] = useState<{ count: number; audience: string } | null>(null)
  const [isCounting, setIsCounting] = useState(false)

  const handleSend = async () => {
    if (!currentOrganizationId) return
    if (!recipientType) {
      toast.error("Choose who receives this email")
      return
    }
    if (!recipientsReady) {
      toast.error(recipientType === "by_event" ? "Choose an event" : "Choose at least one status")
      return
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required")
      return
    }
    setIsCounting(true)
    const r = await call(`/api/admin/org/${currentOrganizationId}/communications/recipients`, "POST", { recipientFilter: recipientFilter() })
    setIsCounting(false)
    if (!r.ok) { toast.error(r.message); return }
    const count = Number((r.data as { count?: number } | undefined)?.count ?? 0)
    if (count === 0) {
      toast.error("Nobody matches these recipients yet")
      return
    }
    setConfirmSend({ count, audience: audienceText(recipientFilter(), events) })
  }

  const sendNow = async () => {
    if (!currentOrganizationId) return
    setIsSending(true)
    const r = await call(`/api/admin/org/${currentOrganizationId}/communications/send`, "POST", {
      recipientFilter: recipientFilter(),
      subject,
      body,
      format: "text",
      ...(draftId ? { draftId } : {}),
    })
    setIsSending(false)
    if (!r.ok) { toast.error(r.message); return }
    setConfirmSend(null)
    toast.success(r.message)
    resetComposer()
    load()
  }

  const handleSaveDraft = async () => {
    if (!currentOrganizationId) return
    if (!subject.trim() && !body.trim()) {
      toast.error("Write a subject or a message first")
      return
    }
    setIsSavingDraft(true)
    const r = await call(`/api/admin/org/${currentOrganizationId}/communications/drafts`, "POST", {
      ...(draftId ? { id: draftId } : {}),
      subject,
      body,
      recipientFilter: recipientFilter(),
    })
    setIsSavingDraft(false)
    if (!r.ok) { toast.error(r.message); return }
    setDraftId((r.data as Draft).id)
    toast.success(draftId ? "Draft updated" : "Draft saved")
    load()
  }

  const openDraft = (d: Draft) => {
    setSubject(d.subject)
    setBody(d.body)
    setRecipientType(d.recipientFilter?.type ?? "")
    setEventId(d.recipientFilter?.eventId ?? "")
    setStatuses(d.recipientFilter?.statuses?.length ? d.recipientFilter.statuses : ["CONFIRMED", "CHECKED_IN"])
    setDraftId(d.id)
    setTab("compose")
  }

  const removeDraft = async (d: Draft) => {
    if (!currentOrganizationId) return
    const r = await call(`/api/admin/org/${currentOrganizationId}/communications/drafts/${d.id}`, "DELETE")
    if (!r.ok) { toast.error(r.message); return }
    toast.success("Draft deleted")
    if (draftId === d.id) setDraftId(null)
    setDeleteDraftTarget(null)
    load()
  }

  const applyTemplate = (t: (typeof EMAIL_TEMPLATES)[number]) => {
    setSubject(t.subject)
    setBody(t.body)
    setDraftId(null)
    setTab("compose")
  }

  const editingDraft = draftId ? drafts.find((d) => d.id === draftId) : null

  const sentColumns: ColumnDef<SentRow, unknown>[] = [
    { accessorKey: "subject", header: "Subject", cell: ({ getValue }) => <span className="block max-w-[360px] truncate font-medium">{getValue() as string}</span> },
    { accessorKey: "audience", header: "Sent to", cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span> },
    {
      accessorKey: "recipients",
      header: "Recipients",
      meta: { align: "right" },
      cell: ({ getValue }) => {
        const n = getValue() as number | null
        return n === null ? "—" : n.toLocaleString("en-IN")
      },
    },
    { accessorKey: "sentBy", header: "By", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "sentAt", header: "Sent", cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDateTime(getValue() as string)}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Communications" description="Email participants, post event announcements, and keep drafts" />

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-5">
        <TabsList variant="line">
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts {drafts.length > 0 && <span className="text-muted-foreground tabular-nums">{drafts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="history">Sent</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Compose */}
        <TabsContent value="compose" className="max-w-3xl">
          {!canSend ? (
            <EmptyState icon={Send} title="You can't send emails here" description="Ask an organization admin for email access." />
          ) : (
            <Card className="gap-0 p-0">
              {draftId && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-raised px-5 py-2.5 text-[13px]">
                  <span className="text-muted-foreground">
                    Editing a draft{editingDraft ? ` saved ${fmtDateTime(editingDraft.updatedAt)}` : ""}
                  </span>
                  <Button variant="ghost" size="xs" onClick={resetComposer}>New message</Button>
                </div>
              )}
              <form className="space-y-5 p-5" onSubmit={(e) => { e.preventDefault(); handleSend() }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="comm-recipients">Recipients</Label>
                    <Select value={recipientType || null} onValueChange={(v) => setRecipientType((v as RecipientType) || "")}>
                      <SelectTrigger id="comm-recipients" className="w-full" aria-required>
                        <SelectValue placeholder="Choose recipients">
                          {(v: RecipientType | null) => (v ? RECIPIENTS[v] ?? v : "Choose recipients")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(RECIPIENTS) as RecipientType[]).map((k) => <SelectItem key={k} value={k}>{RECIPIENTS[k]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {recipientType === "by_event" && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="comm-event">Event</Label>
                      <EventSelect id="comm-event" value={eventId} onChange={setEventId} events={events} />
                    </div>
                  )}
                </div>
                {recipientType === "all" && (
                  <p className="-mt-3 text-[13px] text-muted-foreground">Everyone registered for your events, except cancelled and rejected registrations.</p>
                )}
                {recipientType === "by_status" && (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1.5 text-sm font-medium">Registration status</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {STATUS_CHOICES.map((s) => (
                        <label key={s} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={statuses.includes(s)}
                            onCheckedChange={(checked) => setStatuses((prev) => (checked ? [...prev, s] : prev.filter((x) => x !== s)))}
                          />
                          {statusLabel(s)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="comm-subject">Subject</Label>
                  <Input id="comm-subject" placeholder="Email subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="comm-body">Message</Label>
                    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Insert a merge tag">
                      <span className="mr-1 text-xs text-muted-foreground">Insert</span>
                      {MERGE_TAGS.map((mt) => (
                        <Button key={mt.tag} type="button" variant="outline" size="xs" onClick={() => insertTag(mt.tag)} title={mt.tag} className="font-normal">
                          {mt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Textarea id="comm-body" placeholder="Write your message" rows={10} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
              </form>
              <div className="flex flex-col-reverse gap-2 border-t border-rule px-5 py-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || isSending}>
                  {isSavingDraft && <Loader2 className="animate-spin" />} {draftId ? "Update draft" : "Save as draft"}
                </Button>
                <Button onClick={handleSend} disabled={isSending || isSavingDraft || isCounting}>
                  {isSending || isCounting ? <Loader2 className="animate-spin" /> : <Send />}
                  Send now
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Drafts */}
        <TabsContent value="drafts">
          {isLoading ? (
            <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : drafts.length === 0 ? (
            <EmptyState icon={FileText} title="No drafts" description="Save a message from Compose to finish it later." />
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
              {drafts.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.subject || "(No subject)"}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {audienceText(d.recipientFilter, events)} · Saved {fmtDateTime(d.updatedAt)}{d.updatedByName ? ` by ${d.updatedByName}` : ""}
                    </p>
                  </div>
                  {canSend && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" className="max-sm:flex-1" onClick={() => openDraft(d)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive max-sm:flex-1" onClick={() => setDeleteDraftTarget(d)}>Delete</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Sent */}
        <TabsContent value="history">
          <DataTable
            columns={sentColumns}
            data={sent}
            isLoading={isLoading}
            emptyState={<EmptyState icon={History} title="No sent messages yet" description="Emails you send from Compose are listed here." className="border-0 py-6" />}
          />
        </TabsContent>

        {/* Announcements */}
        <TabsContent value="announcements">
          {currentOrganizationId && <AnnouncementsPanel orgId={currentOrganizationId} events={events} />}
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates">
          <section aria-labelledby="tpl-heading" className="space-y-3">
            <h2 id="tpl-heading" className="text-[15px] font-semibold">Email templates</h2>
            <ul className="grid gap-px overflow-hidden rounded-lg border bg-rule sm:grid-cols-2">
              {EMAIL_TEMPLATES.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-4 bg-background px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{t.desc}</p>
                  </div>
                  {canSend && (
                    <Button variant="outline" size="sm" onClick={() => applyTemplate(t)} aria-label={`Use the ${t.name} template`}>Use</Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmSend !== null} onOpenChange={(o) => { if (!o && !isSending) setConfirmSend(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send to {confirmSend?.count.toLocaleString("en-IN")} {confirmSend?.count === 1 ? "person" : "people"}?
            </DialogTitle>
            <DialogDescription>
              “{subject.trim() || "(No subject)"}” goes out now by email, with an in-app notification, to {confirmSend?.audience.toLowerCase() === "all participants" ? "all participants of your events" : confirmSend?.audience}. Emails can&apos;t be recalled once sent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isSending} />}>Cancel</DialogClose>
            <Button onClick={() => void sendNow()} disabled={isSending}>
              {isSending ? <Loader2 className="animate-spin" /> : <Send />} Send to {confirmSend?.count.toLocaleString("en-IN")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDraftTarget !== null} onOpenChange={(o) => { if (!o) setDeleteDraftTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>“{deleteDraftTarget?.subject || "(No subject)"}” will be gone for everyone on the team.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => deleteDraftTarget && removeDraft(deleteDraftTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
