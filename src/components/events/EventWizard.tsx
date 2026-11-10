"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Check, ChevronLeft, ChevronRight, Save, Loader2, Eye, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/utils"
import { eventScheduleIssues, type CustomFormFieldInput } from "@/lib/validations/event"
import { DEFAULT_EVENT_TIME_ZONE, fromZonedInputValue, viewerTimeZone } from "@/lib/event-time"

import { wizardSchema, STEPS, type WizardFormData, type WizardTicketType } from "./wizard/shared"
import { Step1Basic } from "./wizard/Step1Basic"
import { Step2DateVenue } from "./wizard/Step2DateVenue"
import { Step3Tickets } from "./wizard/Step3Tickets"
import { Step4Form } from "./wizard/Step4Form"
import { Step5Media } from "./wizard/Step5Media"
import { Step6Review } from "./wizard/Step6Review"

type Faq = { question: string; answer: string }
type Sponsor = { name: string; tier: string; website: string }
type Addon = { name: string; price: number; category: string; maxQuantity: number }

interface EventWizardProps {
  orgId: string
  initialData?: Partial<WizardFormData> & {
    id?: string
    /** The event's current status (edit mode): a live event is saved, never sent back to draft. */
    status?: string
    ticketTypes?: WizardTicketType[]
    customFormFields?: CustomFormFieldInput[]
    faqs?: Faq[]
    sponsors?: Sponsor[]
    addons?: Addon[]
  }
  mode?: "create" | "edit"
}

const trimmed = (s: string | null | undefined) => (s ?? "").trim()
const intOrNull = (s: string | null | undefined) => {
  const n = parseInt(s ?? "", 10)
  return Number.isFinite(n) ? n : null
}
const numOrNull = (s: string | null | undefined) => {
  const n = parseFloat(s ?? "")
  return Number.isFinite(n) ? n : null
}
/** "meet.example.com/x" -> "https://meet.example.com/x"; empty stays empty. */
const withScheme = (s: string | null | undefined) => {
  const v = trimmed(s)
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v
}
const isUrl = (s: string) => {
  try { return /^https?:$/.test(new URL(s).protocol) } catch { return false }
}

export function EventWizard({ orgId, initialData, mode = "create" }: EventWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  // The event this wizard writes to: set in edit mode, and after the first save in create
  // mode (so Preview or Save twice updates the same draft instead of creating another).
  const [savedId, setSavedId] = useState<string | undefined>(initialData?.id)
  const isLive = mode === "edit" && !!initialData?.status && initialData.status !== "DRAFT"
  const [ticketTypes, setTicketTypes] = useState<WizardTicketType[]>(
    initialData?.ticketTypes?.length
      ? initialData.ticketTypes
      : [{ name: "General Admission", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }]
  )
  const [customFields, setCustomFields] = useState<CustomFormFieldInput[]>(initialData?.customFormFields || [])
  const [faqs, setFaqs] = useState<Faq[]>(initialData?.faqs || [])
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialData?.sponsors || [])
  const [addons, setAddons] = useState<Addon[]>(initialData?.addons || [])

  const {
    register,
    watch,
    setValue,
    trigger,
    getValues,
    getFieldState,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema) as any,
    defaultValues: {
      title: "",
      slug: "",
      shortDescription: "",
      description: "",
      type: "SINGLE",
      category: "",
      tags: [],
      visibility: "PUBLIC",
      startDate: "",
      endDate: "",
      // A new event starts in the organizer's own zone: the times they type are their clock.
      timezone: mode === "create" ? viewerTimeZone() ?? DEFAULT_EVENT_TIME_ZONE : DEFAULT_EVENT_TIME_ZONE,
      isOnline: false,
      isPaid: false,
      waitlistEnabled: false,
      approvalRequired: false,
      allowTeamRegistration: false,
      contactEmail: "",
      coverImage: "",
      collectPhone: true,
      collectOrganization: false,
      collectDepartment: false,
      ...initialData,
    },
  })

  const title = watch("title")

  // A new event starts from the organization's event defaults (Settings → Event defaults):
  // "Require approval" switches on registration approval unless it was already changed here.
  useEffect(() => {
    if (mode !== "create" || !orgId) return
    let cancelled = false
    fetch(`/api/admin/org/${orgId}/settings`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.success) return
        if (json.data?.eventDefaults?.requireApproval === true && !getFieldState("approvalRequired").isDirty) {
          setValue("approvalRequired", true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mode, orgId, setValue, getFieldState])

  // The URL follows the title until the organizer types in the URL field (then it is theirs).
  // A user edit arrives as a "change" event; setValue below doesn't.
  const slugEdited = useRef(mode === "edit")
  useEffect(() => {
    const sub = watch((_values, { name, type }) => {
      if (name === "slug" && type === "change") slugEdited.current = true
    })
    return () => sub.unsubscribe()
  }, [watch])
  useEffect(() => {
    if (mode === "create" && title && !slugEdited.current) {
      setValue("slug", slugify(title), { shouldValidate: !!getFieldState("slug").error })
    }
  }, [title, mode, setValue, getFieldState])

  // Toasts stack bottom-right (bottom on phones), where this sticky footer and its Next
  // button sit: lift them above the footer while the wizard is open.
  const footerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const footer = footerRef.current
    const root = document.documentElement
    if (!footer) return
    const update = () => {
      const bottom = parseFloat(getComputedStyle(footer).bottom) || 0
      const clearance = `${Math.ceil(footer.offsetHeight + bottom + 12)}px`
      root.style.setProperty("--toast-offset-bottom", clearance)
      root.style.setProperty("--toast-bottom", clearance)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(footer)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
      root.style.removeProperty("--toast-offset-bottom")
      root.style.removeProperty("--toast-bottom")
    }
  }, [])

  /** The datetime-local values, read on the event zone's clock. */
  const scheduleDates = (v = getValues()) => {
    const tz = v.timezone || DEFAULT_EVENT_TIME_ZONE
    return {
      startDate: fromZonedInputValue(v.startDate, tz),
      endDate: fromZonedInputValue(v.endDate, tz),
      registrationStartDate: fromZonedInputValue(v.registrationStartDate, tz),
      registrationEndDate: fromZonedInputValue(v.registrationEndDate, tz),
    }
  }

  /** End after start, registration window within the event: the server checks the same rules. */
  const checkSchedule = (): boolean => {
    clearErrors(["registrationStartDate", "registrationEndDate"])
    const issues = eventScheduleIssues(scheduleDates())
    for (const issue of issues) setError(issue.path, { type: "schedule", message: issue.message })
    return issues.length === 0
  }

  const validateStep = async (stepNum: number): Promise<boolean> => {
    const fieldsPerStep: Record<number, (keyof WizardFormData)[]> = {
      1: ["title", "slug", "shortDescription", "description", "type", "category", "visibility"],
      2: ["startDate", "endDate", "timezone"],
      3: [], 4: [], 5: [], 6: [],
    }
    const fields = fieldsPerStep[stepNum] || []
    if (fields.length === 0) return true
    const valid = await trigger(fields)
    return stepNum === 2 ? checkSchedule() && valid : valid
  }

  const goNext = async () => {
    const valid = await validateStep(step)
    if (valid && step < 6) setStep(step + 1)
  }

  const goBack = () => { if (step > 1) setStep(step - 1) }

  /**
   * The request body, field by field (no stray form keys). Creating, an empty value is left
   * out; updating, it is sent as null so a cleared field is cleared on the event too.
   * Wizard-only settings go in `settings`, where null removes the key.
   */
  const buildPayload = (status: "DRAFT" | "PUBLISHED" | undefined, updating: boolean) => {
    const v = getValues()
    const empty = updating ? null : undefined
    const or = <T,>(value: T | null | "") => (value === null || value === "" ? empty : value)
    const recurring = v.type === "RECURRING" && !!v.recurrencePattern
    const dynamic = !!(v.isPaid && v.enableDynamicPricing)
    const budget = numOrNull(v.budgetAmount)
    const guests = intOrNull(v.maxGuestsPerRegistration)
    const cleanAddons = addons.filter((a) => a.name.trim())
    const dates = scheduleDates(v)
    // A draft saved before its dates are filled in gets placeholder times (now, plus an hour)
    // that pass the end-after-start rule; publishing checks the real ones first.
    const start = dates.startDate ?? new Date()
    const end = dates.endDate ?? new Date(start.getTime() + 60 * 60 * 1000)

    return {
      title: trimmed(v.title),
      slug: trimmed(v.slug),
      shortDescription: trimmed(v.shortDescription),
      description: trimmed(v.description),
      type: v.type,
      category: v.category,
      tags: v.tags ?? [],
      visibility: v.visibility,
      // Wall-clock times in the event's zone, sent as instants.
      startDate: start,
      endDate: end,
      timezone: v.timezone || DEFAULT_EVENT_TIME_ZONE,
      registrationStartDate: dates.registrationStartDate ?? empty,
      registrationEndDate: dates.registrationEndDate ?? empty,
      isOnline: !!v.isOnline,
      venue: or(trimmed(v.venue)),
      venueAddress: or(trimmed(v.venueAddress)),
      venueCity: or(trimmed(v.venueCity)),
      venueState: or(trimmed(v.venueState)),
      venueCountry: or(trimmed(v.venueCountry)),
      onlinePlatform: or(trimmed(v.onlinePlatform)),
      onlineLink: or(withScheme(v.onlineLink)),
      isPaid: !!v.isPaid,
      maxCapacity: or(intOrNull(v.maxCapacity)),
      waitlistEnabled: !!v.waitlistEnabled,
      approvalRequired: !!v.approvalRequired,
      allowTeamRegistration: !!v.allowTeamRegistration,
      minTeamSize: or(v.allowTeamRegistration ? intOrNull(v.minTeamSize) : null),
      maxTeamSize: or(v.allowTeamRegistration ? intOrNull(v.maxTeamSize) : null),
      coverImage: or(trimmed(v.coverImage)),
      rules: or(trimmed(v.rules)),
      termsAndConditions: or(trimmed(v.termsAndConditions)),
      refundPolicy: or(trimmed(v.refundPolicy)),
      contactEmail: or(trimmed(v.contactEmail)),
      contactPhone: or(trimmed(v.contactPhone)),
      seoTitle: or(trimmed(v.seoTitle)),
      seoDescription: or(trimmed(v.seoDescription)),
      ticketTypes: ticketTypes.map((tt, i) => ({
        ...(tt.id ? { id: tt.id } : {}),
        name: trimmed(tt.name),
        description: tt.description || "",
        price: v.isPaid ? Number(tt.price) || 0 : 0,
        currency: tt.currency || "INR",
        quantity: typeof tt.quantity === "number" && tt.quantity > 0 ? tt.quantity : null,
        maxPerUser: tt.maxPerUser || 1,
        isActive: tt.isActive ?? true,
        isHidden: tt.isHidden ?? false,
        sortOrder: i,
      })),
      customFormFields: customFields.filter((f) => f.label.trim()).map((f, i) => ({ ...f, label: f.label.trim(), sortOrder: i })),
      faqs: faqs
        .filter((f) => f.question.trim() && f.answer.trim())
        .map((f, i) => ({ question: f.question.trim(), answer: f.answer.trim(), sortOrder: i })),
      sponsors: sponsors
        .filter((s) => s.name.trim())
        .map((s, i) => {
          const website = withScheme(s.website)
          return { name: s.name.trim(), tier: s.tier.trim() || "GOLD", website: isUrl(website) ? website : "", sortOrder: i }
        }),
      // Sessions, gallery and SEO keywords aren't edited here: an update leaves them alone.
      ...(updating ? {} : { sessions: [], gallery: [], seoKeywords: [] }),
      settings: {
        allowedEmailDomains: trimmed(v.allowedEmailDomains) || null,
        recurrencePattern: recurring ? v.recurrencePattern : null,
        recurrenceCount: recurring ? Math.min(52, Math.max(1, intOrNull(v.recurrenceCount) ?? 1)) : null,
        budgetAmount: budget,
        budgetNotes: budget !== null ? trimmed(v.budgetNotes) || null : null,
        maxGuestsPerRegistration: guests !== null ? Math.min(10, Math.max(0, guests)) : null,
        addons: cleanAddons.length > 0 ? cleanAddons : null,
        enableDynamicPricing: dynamic ? true : null,
        dynamicPricingTiers: dynamic ? trimmed(v.dynamicPricingTiers) || null : null,
        registrationFields: {
          phone: !!v.collectPhone,
          organization: !!v.collectOrganization,
          department: !!v.collectDepartment,
        },
      },
      ...(status ? { status } : {}),
    }
  }

  const submitEvent = async (status?: "DRAFT" | "PUBLISHED") => {
    const url = savedId ? `/api/admin/org/${orgId}/events/${savedId}` : `/api/admin/org/${orgId}/events`
    const res = await fetch(url, {
      method: savedId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(status, !!savedId)),
    })
    const result = await res.json()
    if (result.success && !savedId && result.data?.id) {
      // Later saves update this draft; the server may have made the slug unique.
      setSavedId(result.data.id)
      if (result.data.slug) setValue("slug", result.data.slug)
    }
    return result
  }

  const saveAsDraft = async () => {
    setIsSaving(true)
    try {
      // A live event keeps its status; anything else is saved as a draft.
      const result = await submitEvent(isLive ? undefined : "DRAFT")
      if (!result.success) { toast.error(result.message || "Failed to save"); return }
      toast.success(isLive ? "Changes saved" : "Draft saved")
      if (mode === "create") router.push("/admin/org/events")
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const saveAndClose = async () => {
    setIsSaving(true)
    try {
      const result = await submitEvent()
      if (!result.success) { toast.error(result.message || "Failed to save"); return }
      toast.success("Changes saved")
      router.push(savedId ? `/admin/org/events/${savedId}` : "/admin/org/events")
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const previewAsAttendee = async () => {
    // Save first so the preview reflects current form values, then open the public page in preview mode.
    setIsSaving(true)
    try {
      const result = await submitEvent(isLive ? undefined : "DRAFT")
      if (!result.success || !result.data?.slug) {
        toast.error(result.message || "Save the event first to preview it")
        return
      }
      window.open(`/events/${result.data.slug}?preview=1`, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Failed to open preview")
    } finally {
      setIsSaving(false)
    }
  }

  const requestPublish = async () => {
    const allValid = await trigger()
    if (!allValid) { toast.error("Please fill in all required fields"); return }
    if (!checkSchedule()) {
      setStep(2)
      toast.error("Check the dates: the event must end after it starts, and registration must close by the end.")
      return
    }
    setShowPublishConfirm(true)
  }

  const confirmPublish = async () => {
    setShowPublishConfirm(false)
    setIsPublishing(true)
    try {
      const result = await submitEvent("PUBLISHED")
      if (!result.success) { toast.error(result.message || "Failed to publish"); return }
      // An enterprise that requires approval answers with PENDING_APPROVAL and says so
      toast.success(result.data?.status === "PENDING_APPROVAL" ? (result.message || "Submitted for approval") : "Event published successfully!")
      router.push("/admin/org/events")
    } catch { toast.error("Failed to publish event") } finally { setIsPublishing(false) }
  }

  // Ticket type handlers
  const addTicketType = () => setTicketTypes([...ticketTypes, { name: "", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: ticketTypes.length }])
  const removeTicketType = (i: number) => setTicketTypes(ticketTypes.filter((_, j) => j !== i))
  const updateTicketType = (i: number, field: string, value: unknown) => {
    const updated = [...ticketTypes]
    updated[i] = { ...updated[i], [field]: value }
    setTicketTypes(updated)
  }

  // Custom field handlers
  const addCustomField = (fieldType: string) => setCustomFields([...customFields, { label: "", fieldType: fieldType as CustomFormFieldInput["fieldType"], isRequired: false, options: [], sortOrder: customFields.length }])
  const removeCustomField = (i: number) => setCustomFields(customFields.filter((_, j) => j !== i))
  const updateCustomField = (i: number, field: string, value: unknown) => {
    const updated = [...customFields]
    updated[i] = { ...updated[i], [field]: value }
    setCustomFields(updated)
  }

  const stepProps = { register, watch, setValue, errors }

  const current = STEPS.find((s) => s.id === step) ?? STEPS[0]

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <nav aria-label="Event setup steps">
        {/* phone: the current step and a segmented progress line */}
        <div className="md:hidden">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{current.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">Step {step} of {STEPS.length}</span>
          </div>
          <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => s.id <= step && setStep(s.id)}
                disabled={s.id > step}
                aria-label={`Step ${s.id}: ${s.label}`}
                aria-current={s.id === step ? "step" : undefined}
                className="flex h-6 items-center disabled:cursor-default"
              >
                <span className={cn("h-1 w-full rounded-full", s.id <= step ? "bg-brand" : "bg-muted")} />
              </button>
            ))}
          </div>
        </div>

        {/* tablet and up: numbered steps joined by a rule */}
        <ol className="hidden items-center gap-2 md:flex">
          {STEPS.map((s, i) => {
            const done = s.id < step
            const active = s.id === step
            return (
              <li key={s.id} className={cn("flex min-w-0 items-center gap-2", i < STEPS.length - 1 && "flex-1")}>
                <button
                  type="button"
                  onClick={() => s.id <= step && setStep(s.id)}
                  disabled={s.id > step}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md py-1 pr-1 text-sm transition-colors disabled:cursor-default",
                    active ? "font-medium text-foreground" : done ? "text-foreground hover:text-brand" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                      active ? "border-foreground bg-foreground text-background" : done ? "border-brand bg-brand text-brand-foreground" : "border-border bg-background",
                    )}
                  >
                    {done ? <Check className="size-3.5" aria-hidden /> : s.id}
                  </span>
                  <span className={cn("whitespace-nowrap", !active && "max-xl:sr-only")}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span aria-hidden className={cn("h-px min-w-3 flex-1", done ? "bg-brand" : "bg-border")} />}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="max-w-4xl">
        {step === 1 && <Step1Basic {...stepProps} />}
        {step === 2 && <Step2DateVenue {...stepProps} />}
        {step === 3 && <Step3Tickets {...stepProps} ticketTypes={ticketTypes} addTicketType={addTicketType} removeTicketType={removeTicketType} updateTicketType={updateTicketType} addons={addons} setAddons={setAddons} />}
        {step === 4 && <Step4Form {...stepProps} customFields={customFields} addCustomField={addCustomField} removeCustomField={removeCustomField} updateCustomField={updateCustomField} />}
        {step === 5 && <Step5Media {...stepProps} faqs={faqs} setFaqs={setFaqs} sponsors={sponsors} setSponsors={setSponsors} />}
        {step === 6 && <Step6Review watch={watch} ticketTypes={ticketTypes} customFields={customFields} faqs={faqs} sponsors={sponsors} addons={addons} />}
      </div>

      {/* Footer actions: stick above the phone tab bar, to the sheet's bottom on desktop */}
      <div ref={footerRef} className="sticky bottom-[calc(var(--bottombar-height)+env(safe-area-inset-bottom))] z-20 -mx-4 border-t bg-background px-4 py-3 sm:-mx-6 sm:px-6 lg:bottom-0">
        <div className="flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 max-sm:[&>*]:flex-1">
            <Button type="button" variant="outline" onClick={saveAsDraft} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              {isLive ? "Save changes" : "Save as draft"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={previewAsAttendee}
              disabled={isSaving || isPublishing}
              title={isLive ? "Save and open the public event page in a new tab" : "Save a draft and open the public event page in a new tab"}
            >
              <ExternalLink />
              Preview
            </Button>
          </div>
          <div className="flex gap-2 max-sm:[&>*]:flex-1">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={goBack}>
                <ChevronLeft /> Back
              </Button>
            )}
            {step < 6 ? (
              <Button type="button" onClick={goNext}>
                Next <ChevronRight />
              </Button>
            ) : isLive ? (
              <Button type="button" onClick={saveAndClose} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                Save and close
              </Button>
            ) : (
              <Button type="button" onClick={requestPublish} disabled={isPublishing}>
                {isPublishing ? <Loader2 className="animate-spin" /> : <Eye />}
                Publish event
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Publish this event?</DialogTitle>
            <DialogDescription>
              Your event will go live and become visible to everyone. People will be able to find and register for it.
              You can still edit details later, but new attendees may already start signing up.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)}>Keep as draft</Button>
            <Button onClick={confirmPublish}>
              <Eye />
              Yes, publish now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
