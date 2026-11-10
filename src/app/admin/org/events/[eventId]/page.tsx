"use client"

import { use, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, BarChart3, Calendar, Copy, ExternalLink, Loader2, MoreHorizontal, Pencil, QrCode, Rocket, Share2, Trash2, UserPlus, Users, XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { ShareModal } from "@/components/events/ShareModal"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { usePermissions } from "@/hooks/usePermissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import {
  CancelEventDialog, CapacityBar, Fact, ZoneNote, enumLabel, fmtDate, fmtDay, fmtTime, inr, type ApprovalRejection,
} from "../_components/event-admin"
import { formatInZone } from "@/lib/event-time"
import { AddParticipantDialog } from "../_components/registration-admin"

const formatDate = (d: string | null, timeZone?: string | null) =>
  d ? formatInZone(d, timeZone, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not set"

// Prisma decimals arrive as strings ("0", "499.00").
const price = (p: number | string) => (Number(p) === 0 ? "Free" : inr(Number(p)))

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()
  const { currentOrganizationId } = useRBAC()
  const { hasPermission, isLoading: permsLoading } = usePermissions()
  const [activeTab, setActiveTab] = useState("overview")
  const [event, setEvent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState<"publish" | "duplicate" | "delete" | null>(null)

  const fetchEvent = useCallback(async () => {
    if (!currentOrganizationId) return
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}`)
      const json = await res.json()
      if (json.success) setEvent(json.data)
    } catch {} finally { setIsLoading(false) }
  }, [currentOrganizationId, eventId])

  useEffect(() => { fetchEvent() }, [fetchEvent])

  // Header actions: each calls its own route (publish / duplicate / delete).
  const runAction = async (kind: "publish" | "duplicate" | "delete") => {
    if (!currentOrganizationId) return
    setBusy(kind)
    try {
      const base = `/api/admin/org/${currentOrganizationId}/events/${eventId}`
      const res = await fetch(kind === "delete" ? base : `${base}/${kind}`, { method: kind === "delete" ? "DELETE" : "POST" })
      const json = await res.json()
      if (!json.success) { toast.error(json.message || "Something went wrong"); return }
      if (kind === "publish") { toast.success(json.message || "Event published"); void fetchEvent() }
      if (kind === "duplicate") { toast.success("Duplicated as a draft"); router.push(`/admin/org/events/${json.data.id}/edit`) }
      if (kind === "delete") { toast.success("Event deleted"); setDeleteOpen(false); router.push("/admin/org/events") }
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading event">
        <div className="space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <Skeleton className="h-[98px] rounded-lg" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <EmptyState variant="page" icon={Calendar} title="Event not found." description="It may have been deleted, or it belongs to another organization.">
        <Link href="/admin/org/events" className={buttonVariants({ variant: "outline" })}>Back to events</Link>
      </EmptyState>
    )
  }

  const eventUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/events/${event.slug}`
  const registrations = event._count?.registrations || 0
  const checkIns = event._count?.checkIns || 0
  const attendancePct = registrations > 0 ? Math.round((checkIns / registrations) * 100) : 0
  const settings = (event.settings as any) || {}
  const formFields: { phone: boolean; organization: boolean; department: boolean } =
    event.registrationFields ?? { phone: true, organization: false, department: false }
  const canSeeRevenue = !permsLoading && hasPermission(PERMISSIONS.PAYMENT_VIEW) && event.revenue !== null && event.revenue !== undefined
  const isDraft = event.status === "DRAFT"
  const rejection = (event.approvalRejection ?? null) as ApprovalRejection | null
  const canAddParticipants = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"].includes(event.status)
  const where = event.isOnline ? (event.onlinePlatform ? enumLabel(event.onlinePlatform) : "Online") : event.venue || null
  // Same calendar day on the event zone's clock.
  const sameDay = event.endDate && fmtDate(event.startDate, event.timezone) === fmtDate(event.endDate, event.timezone)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/admin/org/events" className="inline-flex items-center gap-1.5 rounded-sm text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Events
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">{event.title}</h1>
              <div className="flex items-center gap-1.5">
                <Pill tone={statusTone(event.status)}>{statusLabel(event.status)}</Pill>
                <Pill tone="neutral">{enumLabel(event.visibility)}</Pill>
              </div>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {[
                fmtDay(event.startDate, event.timezone),
                event.endDate
                  ? sameDay
                    ? `${fmtTime(event.startDate, event.timezone)} – ${fmtTime(event.endDate, event.timezone)}`
                    : `${fmtTime(event.startDate, event.timezone)} – ${fmtDay(event.endDate, event.timezone)}, ${fmtTime(event.endDate, event.timezone)}`
                  : fmtTime(event.startDate, event.timezone),
                where,
                event.category ? enumLabel(event.category) : null,
              ].filter(Boolean).join(" · ")}
              <ZoneNote timeZone={event.timezone} at={event.startDate} className="before:content-['_·_']" />
            </p>
            {event.shortDescription && <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground">{event.shortDescription}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a href={eventUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost" })}>
              <ExternalLink /> View public page
            </a>
            <ShareModal
              url={eventUrl}
              title={event.title}
              description={event.shortDescription}
              trigger={<Button variant="ghost"><Share2 /> Share</Button>}
            />
            <PermissionGate permission={PERMISSIONS.EVENT_EDIT}>
              <Link href={`/admin/org/events/${eventId}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil /> Edit event
              </Link>
            </PermissionGate>
            {isDraft && !rejection && (
              <PermissionGate permission={PERMISSIONS.EVENT_PUBLISH}>
                <Button onClick={() => void runAction("publish")} disabled={busy !== null}>
                  {busy === "publish" ? <Loader2 className="animate-spin" /> : <Rocket />} Publish
                </Button>
              </PermissionGate>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem render={<Link href={`/admin/org/events/${eventId}/registrations`} />}><Users /> Registrations</DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/admin/org/events/${eventId}/check-in`} />}><QrCode /> Check-in</DropdownMenuItem>
                <PermissionGate permission={PERMISSIONS.ANALYTICS_VIEW_BASIC}>
                  <DropdownMenuItem render={<Link href={`/admin/org/events/${eventId}/analytics`} />}><BarChart3 /> Analytics</DropdownMenuItem>
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
                  <DropdownMenuItem disabled={busy !== null} onClick={() => void runAction("duplicate")}><Copy /> Duplicate</DropdownMenuItem>
                </PermissionGate>
                <PermissionGate permission={[PERMISSIONS.EVENT_CANCEL, PERMISSIONS.EVENT_DELETE]}>
                  <DropdownMenuSeparator />
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.EVENT_CANCEL}>
                  <DropdownMenuItem variant="destructive" disabled={event.status === "CANCELLED"} onClick={() => setCancelOpen(true)}>
                    <XCircle /> Cancel event
                  </DropdownMenuItem>
                </PermissionGate>
                {registrations === 0 && (
                  <PermissionGate permission={PERMISSIONS.EVENT_DELETE}>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 /> Delete event
                    </DropdownMenuItem>
                  </PermissionGate>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* The enterprise sent it back: its reason, and the way back into review */}
      {rejection && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border bg-raised px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="wrap-break-word whitespace-pre-wrap">
              <span className="font-medium">Rejected by {rejection.enterpriseName || "your enterprise"}</span>
              {rejection.reason ? `: ${rejection.reason}` : ""}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {fmtDate(rejection.decidedAt)}
              {rejection.decidedByName ? ` · ${rejection.decidedByName}` : ""}
              {" · "}
              {hasPermission(PERMISSIONS.EVENT_EDIT) ? (
                <Link href={`/admin/org/events/${eventId}/edit`} className="underline underline-offset-4 hover:text-foreground">Edit the event</Link>
              ) : "Edit the event"}
              , then resubmit it for approval.
            </p>
          </div>
          <PermissionGate permission={PERMISSIONS.EVENT_PUBLISH}>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => void runAction("publish")} disabled={busy !== null}>
              {busy === "publish" ? <Loader2 className="animate-spin" /> : <Rocket />} Resubmit for approval
            </Button>
          </PermissionGate>
        </div>
      )}

      {/* Numbers */}
      <KpiStrip
        items={[
          { label: "Registrations", value: registrations.toLocaleString("en-IN"), caption: "total" },
          {
            label: "Capacity",
            value: event.maxCapacity ? Number(event.maxCapacity).toLocaleString("en-IN") : "∞",
            caption: event.maxCapacity ? `${Math.round((registrations / event.maxCapacity) * 100)}% filled` : "unlimited",
          },
          ...(canSeeRevenue
            ? [{ label: "Revenue", value: event.isPaid || event.revenue > 0 ? inr(Math.round(event.revenue)) : "Free", caption: event.isPaid ? "net of refunds" : undefined }]
            : []),
          { label: "Check-ins", value: checkIns.toLocaleString("en-IN"), caption: `${attendancePct}% attendance` },
        ]}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
        <div className="border-b border-rule">
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        {/* TAB: Overview */}
        <TabsContent value="overview" className="pt-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-8">
              <section aria-labelledby="desc-heading">
                <h2 id="desc-heading" className="text-[15px] font-semibold">Description</h2>
                {event.description ? (
                  <p className="mt-2 max-w-[75ch] text-sm leading-6 whitespace-pre-wrap text-muted-foreground">{event.description}</p>
                ) : (
                  <p className="mt-2 text-sm text-faint">No description yet.</p>
                )}
              </section>

              {event.ticketTypes?.length > 0 && (
                <section aria-labelledby="types-heading">
                  <h2 id="types-heading" className="mb-3 text-[15px] font-semibold">Ticket types</h2>
                  <TicketTable>
                    {event.ticketTypes.map((tt: any) => (
                      <TicketRow
                        key={tt.id}
                        name={tt.name}
                        sub={tt.description}
                        price={price(tt.price)}
                        third={tt.quantity ? `${Number(tt.sold || 0).toLocaleString("en-IN")} of ${Number(tt.quantity).toLocaleString("en-IN")} sold` : `${Number(tt.sold || 0).toLocaleString("en-IN")} sold`}
                      />
                    ))}
                  </TicketTable>
                </section>
              )}
            </div>

            <Card className="h-fit gap-0 px-5 py-4">
              <dl className="divide-y divide-rule">
                <Fact label="Date & time">
                  {formatDate(event.startDate, event.timezone)}
                  <span className="block font-normal text-muted-foreground">to {formatDate(event.endDate, event.timezone)}</span>
                  <ZoneNote timeZone={event.timezone} at={event.startDate} className="block text-[13px] font-normal" />
                </Fact>
                <Fact label="Registration window">
                  {event.registrationStartDate ? formatDate(event.registrationStartDate, event.timezone) : "Open"}
                  {event.registrationEndDate && <span className="block font-normal text-muted-foreground">to {formatDate(event.registrationEndDate, event.timezone)}</span>}
                </Fact>
                <Fact label={event.isOnline ? "Online event" : "Venue"}>
                  {event.isOnline ? (event.onlinePlatform ? enumLabel(event.onlinePlatform) : "Virtual") : (event.venue || "Not set")}
                  {!event.isOnline && event.venueCity && (
                    <span className="block font-normal text-muted-foreground">{[event.venueCity, event.venueState].filter(Boolean).join(", ")}</span>
                  )}
                </Fact>
                <Fact label="Capacity">
                  {event.maxCapacity ? (
                    <>
                      <span className="tabular-nums">{registrations.toLocaleString("en-IN")} of {Number(event.maxCapacity).toLocaleString("en-IN")} seats</span>
                      <CapacityBar value={registrations} max={event.maxCapacity} className="mt-2" />
                    </>
                  ) : (
                    "Unlimited"
                  )}
                </Fact>
                <Fact label="Tickets">{event.isPaid ? "Paid" : "Free"} · {event.ticketTypes?.length || 0} types</Fact>
                <Fact label="Type & category">{enumLabel(event.type)} · {enumLabel(event.category)}</Fact>
                {settings.budgetAmount && (
                  <Fact label="Budget">
                    <span className="tabular-nums">₹{Number(settings.budgetAmount).toLocaleString("en-IN")}</span>
                    {settings.budgetNotes && <span className="block font-normal text-muted-foreground">{settings.budgetNotes}</span>}
                  </Fact>
                )}
              </dl>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: Registrations */}
        <TabsContent value="registrations" className="pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">
              Registrations <span className="font-normal text-muted-foreground tabular-nums">{registrations}</span>
            </h2>
            <div className="flex gap-2">
              {canAddParticipants && (
                <PermissionGate permission={PERMISSIONS.REGISTRATION_ADD_MANUAL}>
                  <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}><UserPlus /> Add participant</Button>
                </PermissionGate>
              )}
              <ShareModal
                url={eventUrl}
                title={event.title}
                description={event.shortDescription}
                trigger={<Button variant="outline" size="sm"><Share2 /> Invite</Button>}
              />
            </div>
          </div>
          {registrations === 0 ? (
            <EmptyState title="No registrations yet." description="Share the event to get participants." />
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">{registrations}</span> registration(s). View full details on the registrations page.
              </p>
              <Link href={`/admin/org/events/${eventId}/registrations`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
                Open registrations
              </Link>
            </div>
          )}
        </TabsContent>

        {/* TAB: Tickets */}
        <TabsContent value="tickets" className="pt-6">
          <h2 className="mb-3 text-[15px] font-semibold">Ticket types</h2>
          {event.ticketTypes?.length > 0 ? (
            <TicketTable thirdLabel="Status">
              {event.ticketTypes.map((tt: any) => (
                <TicketRow
                  key={tt.id}
                  name={tt.name}
                  price={price(tt.price)}
                  third={<Pill tone={tt.isActive ? "positive" : "neutral"}>{tt.isActive ? "Active" : "Inactive"}</Pill>}
                />
              ))}
            </TicketTable>
          ) : (
            <EmptyState title="No ticket types configured." />
          )}
        </TabsContent>

        {/* TAB: Check-in */}
        <TabsContent value="checkin" className="pt-6">
          <div className="flex flex-col gap-4 rounded-lg border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[15px] font-medium">{checkIns > 0 ? `${checkIns} checked in` : "No check-ins yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Use the QR scanner for event check-in.</p>
            </div>
            <Link href={`/admin/org/events/${eventId}/check-in`} className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
              <QrCode /> Open scanner
            </Link>
          </div>
        </TabsContent>

        {/* TAB: Settings */}
        <TabsContent value="settings" className="space-y-6 pt-6">
          <SettingsSection title="Registration settings" description="How people sign up for this event.">
            <SettingRow label="Approval required" value={event.approvalRequired ? "Yes" : "No"} />
            <SettingRow label="Waitlist" value={event.waitlistEnabled ? "Enabled" : "Disabled"} />
            <SettingRow label="Team registration" value={event.allowTeamRegistration ? "Enabled" : "Disabled"} />
          </SettingsSection>
          <SettingsSection title="Registration form" description="What the public form asks besides name and email.">
            <SettingRow label="Phone" value={formFields.phone ? "Asked" : "Not asked"} />
            <SettingRow label="Organization / institution" value={formFields.organization ? "Asked" : "Not asked"} />
            <SettingRow label="Department" value={formFields.department ? "Asked" : "Not asked"} />
            <SettingRow label="Custom questions" value={String(event.customFormFields?.length || 0)} />
          </SettingsSection>
          <SettingsSection title="Visibility & access" description="Who can find the event page.">
            <SettingRow label="Visibility" value={enumLabel(event.visibility)} />
            <SettingRow label="Featured" value={event.isFeatured ? "Yes" : "No"} />
            <SettingRow label="Event type" value={enumLabel(event.type)} />
            {settings.allowedEmailDomains && <SettingRow label="Allowed email domains" value={String(settings.allowedEmailDomains)} />}
          </SettingsSection>
        </TabsContent>
      </Tabs>

      <CancelEventDialog
        orgId={currentOrganizationId}
        event={cancelOpen ? { id: event.id, title: event.title } : null}
        onClose={() => setCancelOpen(false)}
        onCancelled={fetchEvent}
      />

      <AddParticipantDialog
        orgId={currentOrganizationId}
        eventId={event.id}
        ticketTypes={event.ticketTypes ?? []}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={fetchEvent}
      />

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (busy !== "delete") setDeleteOpen(open) }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{event.title}. </span>
              It has no registrations. The event and its page are removed; this cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>Keep event</Button>
            <Button variant="destructive" onClick={() => void runAction("delete")} disabled={busy === "delete"}>
              {busy === "delete" && <Loader2 className="animate-spin" />} Delete event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TicketTable({ thirdLabel = "Sold", children }: { thirdLabel?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_140px] gap-4 border-b border-rule bg-raised px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
        <span>Name</span>
        <span className="text-right">Price</span>
        <span className="text-right">{thirdLabel}</span>
      </div>
      <ul className="divide-y divide-rule">{children}</ul>
    </div>
  )
}

function TicketRow({ name, sub, price, third }: { name: string; sub?: string | null; price: string; third: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_140px]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {sub && <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      <p className="text-right text-sm font-medium tabular-nums">{price}</p>
      <div className="col-span-2 text-[13px] text-muted-foreground tabular-nums sm:col-span-1 sm:flex sm:justify-end sm:text-sm">{third}</div>
    </li>
  )
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-6 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <dl className="min-w-0 divide-y divide-rule rounded-lg border px-4">{children}</dl>
    </section>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
