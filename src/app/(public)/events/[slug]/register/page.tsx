"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import {
  AlertTriangle, ArrowLeft, Calendar, Check, CircleCheck, Clock, Info, Loader2, MapPin,
  Minus, Monitor, Plus, Share2, Ticket,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { RegistrationForm } from "@/components/registration/RegistrationForm"
import { cn } from "@/lib/utils"
import { formatInZone } from "@/lib/event-time"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { CheckoutDismissedError, openRazorpayCheckout } from "@/lib/razorpay-checkout"
import { isUploadedFileUrl, readDefaultFields, validateRegistrationDetails, type DetailsErrors } from "@/lib/registration-details"

type RegStep = "ticket" | "details" | "review" | "success"

// Paid registrations: "processing" while Checkout is open or verifying, "retry" after a
// cancelled/failed attempt, "unavailable" when the server has no payment gateway set up,
// "refund" when the payment went through but no seat was left.
type PaymentState = { status: "idle" | "processing" | "retry" | "unavailable" | "refund"; message?: string }

const fmtHoldTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null

interface TicketType {
  id: string
  name: string
  description?: string | null
  price: number
  currency: string
  remaining: number | null
  isSoldOut: boolean
  maxPerUser: number
}

interface FormConfig {
  eventId: string
  title: string
  slug: string
  startDate: string
  endDate: string
  // the event's IANA zone: dates and times below are shown on its clock
  timezone?: string | null
  venue: string | null
  venueAddress: string | null
  venueCity: string | null
  isOnline: boolean
  onlinePlatform: string | null
  contactEmail: string | null
  approvalRequired: boolean
  termsAndConditions: string | null
  isPaid: boolean
  teamSettings: { enabled: boolean; minSize: number; maxSize: number } | null
  /** the event's "Ask for" switches (read by readDefaultFields; older APIs may omit it) */
  registrationFields?: { phone?: unknown; organization?: unknown; department?: unknown } | null
  ticketTypes: TicketType[]
  customFields: any[]
}

export default function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const [step, setStep] = useState<RegStep>("ticket")
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [couponCode, setCouponCode] = useState("")
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponApplied, setCouponApplied] = useState(false)
  const [registrationResult, setRegistrationResult] = useState<any>(null)
  const [paymentState, setPaymentState] = useState<PaymentState>({ status: "idle" })
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null)
  // A guest's view-only ticket link from an earlier registration on this device
  const [savedGuestLink, setSavedGuestLink] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: session?.user?.name || "",
      email: session?.user?.email || "",
      phone: "",
      organization: "",
      department: "",
      agreeToTerms: false,
      // keyed by custom field id (see RegistrationForm)
      customFields: {} as Record<string, unknown>,
    },
  })
  // Set once the attendee tries to leave "Your details"; from then on errors update as they type
  const [detailsAttempted, setDetailsAttempted] = useState(false)

  // Guest checkout: allow registration without account
  // If logged in, pre-fill data. If not, show guest form fields.
  const isGuest = authStatus === "unauthenticated"

  // Pre-fill user data
  useEffect(() => {
    if (session?.user) {
      form.setValue("name", session.user.name || "")
      form.setValue("email", session.user.email || "")
    }
  }, [session, form])

  // Guests keep their ticket link on this device (it is also emailed): offer it again here.
  useEffect(() => {
    if (authStatus !== "unauthenticated") return
    try {
      const saved = JSON.parse(window.localStorage.getItem(`evf:guest-ticket:${slug}`) || "null")
      if (saved && typeof saved.link === "string" && saved.link.startsWith("/events/")) setSavedGuestLink(saved.link)
    } catch {}
  }, [authStatus, slug])

  // "Complete payment" from My events / Tickets (?resume=<registrationId>): reopen the
  // payment step of the signed-in attendee's held registration for this event.
  useEffect(() => {
    if (authStatus !== "authenticated" || !formConfig || registrationResult) return
    const resumeId = new URLSearchParams(window.location.search).get("resume")
    if (!resumeId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/users/me/registrations")
        const json = await res.json()
        const reg = json.success
          ? (json.data as { id: string; status: string; displayStatus: string; registrationNumber: string; holdExpiresAt: string | null; payment: { amount: number } | null; event: { slug: string } }[])
              .find((r) => r.id === resumeId && r.event.slug === slug)
          : null
        if (cancelled || !reg) return
        if (reg.displayStatus !== "PENDING_PAYMENT" || !reg.payment) {
          toast.error("This registration isn't awaiting payment any more.")
          return
        }
        setRegistrationResult({
          registration: { id: reg.id, status: reg.status },
          payment: { status: "PENDING", amount: reg.payment.amount },
          registrationNumber: reg.registrationNumber,
          holdExpiresAt: reg.holdExpiresAt,
          ticket: null,
        })
        setHoldExpiresAt(reg.holdExpiresAt)
        setStep("success")
      } catch {}
    })()
    return () => { cancelled = true }
  }, [authStatus, formConfig, registrationResult, slug])

  // Fetch form config
  useEffect(() => {
    async function fetchForm() {
      try {
        const res = await fetch(`/api/events/${slug}/form`)
        const data = await res.json()
        if (data.success) {
          setFormConfig(data.data)
          // Auto-select ticket if only one
          if (data.data.ticketTypes.length === 1) {
            setSelectedTicketId(data.data.ticketTypes[0].id)
            if (!data.data.isPaid) setStep("details")
          }
        }
      } catch {
        toast.error("Failed to load registration form")
      } finally {
        setIsLoading(false)
      }
    }
    fetchForm()
  }, [slug])

  const selectedTicket = formConfig?.ticketTypes.find((t) => t.id === selectedTicketId)
  const subtotal = selectedTicket ? selectedTicket.price * quantity : 0
  const total = Math.max(0, subtotal - couponDiscount)

  // Built-in fields the event asks for (phone / organization / department), from the form API
  const defaultFields = readDefaultFields(formConfig)
  const checkDetails = (values = form.getValues()): DetailsErrors =>
    formConfig
      ? validateRegistrationDetails(values, {
          defaultFields,
          customFields: formConfig.customFields,
          requireTerms: !!formConfig.termsAndConditions,
        })
      : {}
  // After the first attempt the messages follow the input, so a fixed field clears its message
  const watchedValues = form.watch()
  const detailErrors: DetailsErrors = detailsAttempted && step === "details" ? checkDetails(watchedValues) : {}

  const continueToReview = () => {
    const errors = checkDetails()
    const keys = Object.keys(errors)
    if (keys.length === 0) {
      setDetailsAttempted(false)
      setStep("review")
      return
    }
    setDetailsAttempted(true)
    // Take the attendee to the first field that needs attention
    const first = keys[0]
    let target = first.startsWith("customFields.")
      ? document.getElementById(first.slice("customFields.".length)) ?? document.getElementById(`${first.slice("customFields.".length)}-opt-0`)
      : document.getElementById(DETAIL_FIELD_IDS[first] ?? "")
    // A checkbox's id sits on its hidden input; focus the visible box next to it instead
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      target = target.parentElement?.querySelector<HTMLElement>('[role="checkbox"]') ?? target
    }
    target?.focus()
    toast.error(keys.length === 1 ? "Please fix the highlighted field." : `Please fix the ${keys.length} highlighted fields.`)
  }

  // Custom answers go to the server keyed by the question's label, as before
  const customAnswers = (values: Record<string, unknown>) =>
    Object.fromEntries((formConfig?.customFields ?? []).filter((f) => f.id in values).map((f) => [f.label, values[f.id]]))

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !formConfig) return
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          eventId: formConfig.eventId,
          ticketTypeId: selectedTicket?.id,
          quantity,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCouponDiscount(data.data.discount)
        setCouponApplied(true)
        toast.success("Coupon applied!")
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error("Failed to validate coupon")
    }
  }

  // Opens Razorpay Checkout for a registration that awaits payment, then verifies the
  // payment server-side. The seat stays held (server-side) while the buyer retries.
  const startPayment = async (result: { registration?: { id: string }; holdExpiresAt?: string | null }) => {
    if (!formConfig || !result?.registration?.id) return
    setPaymentState({ status: "processing" })
    try {
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: result.registration.id }),
      })
      const order = await orderRes.json()
      if (!order.success) {
        if (orderRes.status === 503) {
          const until = fmtHoldTime(result.holdExpiresAt ?? holdExpiresAt)
          setPaymentState({
            status: "unavailable",
            message: `Online payment isn't available right now. Your registration is held pending payment${until ? ` until ${until}` : ""}; please contact the organizer to complete it.`,
          })
        } else {
          setPaymentState({ status: "retry", message: order.message || "Could not start the payment. Please try again." })
        }
        return
      }
      if (order.data.holdExpiresAt) setHoldExpiresAt(order.data.holdExpiresAt)
      const until = fmtHoldTime(order.data.holdExpiresAt)

      let paid
      try {
        paid = await openRazorpayCheckout({
          key: order.data.keyId,
          amount: order.data.amount,
          currency: order.data.currency,
          order_id: order.data.orderId,
          name: formConfig.title,
          description: selectedTicket?.name,
          prefill: { name: form.getValues("name"), email: form.getValues("email") },
        })
      } catch (err) {
        const held = until ? ` Your seat is held until ${until}, so you can try again before then.` : ""
        setPaymentState({
          status: "retry",
          message: err instanceof CheckoutDismissedError
            ? `Payment cancelled.${held}`
            : `${err instanceof Error ? err.message : "Payment failed."}${held}`,
        })
        return
      }

      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paid),
      })
      const verified = await verifyRes.json()
      if (!verified.success) {
        setPaymentState({ status: "retry", message: verified.message || "Payment verification failed. Please try again." })
        return
      }

      setRegistrationResult((prev: typeof registrationResult) => ({
        ...prev,
        registration: { ...prev.registration, status: verified.data?.registrationStatus ?? "CONFIRMED" },
        payment: { ...prev.payment, status: "COMPLETED" },
        ticket: verified.data?.ticket ?? prev.ticket,
      }))
      if (verified.data?.refundRequired) {
        setPaymentState({ status: "refund", message: verified.message })
      } else {
        setPaymentState({ status: "idle" })
        toast.success("Payment successful — you're registered!")
      }
    } catch {
      setPaymentState({ status: "retry", message: "Something went wrong with the payment. Please try again." })
    }
  }

  const handleSubmit = async () => {
    if (!formConfig || !selectedTicketId) return
    // The details were checked on the way to Review; never submit if they no longer pass
    if (Object.keys(checkDetails()).length > 0) {
      setStep("details")
      setDetailsAttempted(true)
      return
    }
    // Payments are tied to an account (create-order and verify require a session).
    if (isGuest && total > 0) {
      toast.error("Please sign in to buy a paid ticket.")
      return
    }
    setIsSubmitting(true)
    try {
      const values = form.getValues()
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: formConfig.eventId,
          ticketTypeId: selectedTicketId,
          quantity,
          formResponses: {
            name: values.name.trim(),
            ...(defaultFields.phone !== "hidden" ? { phone: values.phone.trim() } : {}),
            ...(defaultFields.organization !== "hidden" ? { organization: values.organization.trim() } : {}),
            ...(defaultFields.department !== "hidden" ? { department: values.department.trim() } : {}),
            ...customAnswers(values.customFields),
          },
          couponCode: couponApplied ? couponCode : undefined,
          // Guest checkout fields
          ...(isGuest ? { guestEmail: values.email, guestName: values.name } : {}),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.message)
        return
      }
      setRegistrationResult(data.data)
      setHoldExpiresAt(data.data.holdExpiresAt ?? null)
      if (typeof data.data.ticketLink === "string") {
        try {
          window.localStorage.setItem(`evf:guest-ticket:${slug}`, JSON.stringify({ link: data.data.ticketLink, savedAt: new Date().toISOString() }))
        } catch {}
      }
      setStep("success")
      const awaitsPayment = data.data.payment?.status === "PENDING" && data.data.registration?.status === "PENDING"
      if (awaitsPayment) {
        void startPayment(data.data)
      } else {
        toast.success("Registration successful!")
      }
    } catch {
      toast.error("Registration failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authStatus === "loading" || isLoading) {
    return <RegisterSkeleton />
  }

  if (!formConfig) {
    return (
      <div className={`${SHELL} py-20`}>
        <div className="mx-auto max-w-md rounded-lg border border-dashed px-6 py-14 text-center">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">Registration unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Event not found or registration is not available.</p>
          <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>Browse events</Link>
        </div>
      </div>
    )
  }

  // SUCCESS SCREEN
  if (step === "success" && registrationResult) {
    const startDate = new Date(formConfig.startDate)
    const endDate = new Date(formConfig.endDate)
    const sameDay = formatInZone(formConfig.startDate, formConfig.timezone, { dateStyle: "short" }) === formatInZone(formConfig.endDate, formConfig.timezone, { dateStyle: "short" })
    const fmtDate = (d: Date) => formatInZone(d, formConfig.timezone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    const fmtTime = (d: Date) => formatInZone(d, formConfig.timezone, { hour: "2-digit", minute: "2-digit" })
    // Waitlisted registrations can't pay until the organizer confirms a seat.
    const isPaidPending = registrationResult.payment && registrationResult.payment.status === "PENDING" && registrationResult.registration?.status !== "WAITLISTED"
    const hasQR = !!registrationResult.ticket?.qrCode
    // guests only: their private view-only ticket page (no account needed)
    const guestTicketPath: string | null = typeof registrationResult.ticketLink === "string" ? registrationResult.ticketLink : null
    const guestTicketUrl = guestTicketPath ? `${window.location.origin}${guestTicketPath}` : null
    const locationLine = formConfig.isOnline
      ? `${formConfig.onlinePlatform || "Online"} · link will be emailed`
      : [formConfig.venue, formConfig.venueCity].filter(Boolean).join(", ") || "Venue TBA"

    // .ics download (browser-only: build a data URL)
    const buildIcs = () => {
      const toIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
      const lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EventFlow//EN", "BEGIN:VEVENT",
        `UID:${registrationResult.registrationNumber}@eventflow`,
        `DTSTAMP:${toIcsDate(new Date())}`,
        `DTSTART:${toIcsDate(startDate)}`,
        `DTEND:${toIcsDate(endDate)}`,
        `SUMMARY:${formConfig.title}`,
        `LOCATION:${(locationLine || "").replace(/\n/g, " ")}`,
        `DESCRIPTION:Registration #${registrationResult.registrationNumber}`,
        "END:VEVENT", "END:VCALENDAR",
      ]
      return "data:text/calendar;charset=utf8," + encodeURIComponent(lines.join("\r\n"))
    }

    const isRefund = paymentState.status === "refund"
    const isWaiting = isRefund || formConfig.approvalRequired || isPaidPending
    const HeadIcon = isRefund ? AlertTriangle : isWaiting ? Clock : CircleCheck
    const regStatus: string | undefined = registrationResult.registration?.status

    return (
      <div className={cn(SHELL, "max-w-[640px] pt-10 pb-16 sm:pt-14")}>
        <div className="text-center">
          <HeadIcon className={cn("mx-auto size-8", isWaiting ? "text-warning" : "text-positive")} strokeWidth={1.75} aria-hidden />
          <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[28px]">
            {isRefund
              ? "Payment received — no seat left"
              : formConfig.approvalRequired
              ? "Registration submitted"
              : isPaidPending
                ? "Almost done — complete your payment"
                : "You're registered!"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A confirmation has been sent to your email.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {/* Payment for a held seat */}
          {(isPaidPending || paymentState.message) && (
            <div className="rounded-lg border bg-card p-5" aria-live="polite">
              {paymentState.message && (
                <p className="flex items-start gap-2.5 text-sm leading-relaxed">
                  {isRefund || paymentState.status === "retry" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  ) : (
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span>{paymentState.message}</span>
                </p>
              )}
              {isPaidPending && paymentState.status !== "unavailable" && (
                <Button
                  className={cn("h-11 w-full gap-2 text-[15px]", paymentState.message && "mt-4")}
                  disabled={paymentState.status === "processing"}
                  onClick={() => startPayment(registrationResult)}
                >
                  {paymentState.status === "processing" && <Loader2 className="size-4 animate-spin" />}
                  {paymentState.status === "processing"
                    ? "Processing payment…"
                    : `${paymentState.status === "retry" ? "Retry payment" : "Pay"} ₹${Number(registrationResult.payment.amount).toLocaleString("en-IN")}`}
                </Button>
              )}
            </div>
          )}

          {/* The ticket: what you registered for, the QR on white paper (free events), the registration number */}
          <article className="overflow-hidden rounded-xl border bg-card">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg leading-snug font-semibold">{formConfig.title}</h2>
                {regStatus && <Pill tone={statusTone(regStatus)} className="mt-0.5 shrink-0">{statusLabel(regStatus)}</Pill>}
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 shrink-0 text-muted-foreground">
                    <Calendar className="size-4" aria-hidden /><span className="sr-only">Date</span>
                  </dt>
                  <dd>
                    <p className="font-medium">{fmtDate(startDate)}</p>
                    <p className="text-[13px] text-muted-foreground tabular-nums">
                      {fmtTime(startDate)} &ndash; {sameDay ? fmtTime(endDate) : `${fmtDate(endDate)}, ${fmtTime(endDate)}`}
                    </p>
                  </dd>
                </div>
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 shrink-0 text-muted-foreground">
                    {formConfig.isOnline ? <Monitor className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                    <span className="sr-only">Where</span>
                  </dt>
                  <dd className="text-muted-foreground">{locationLine}</dd>
                </div>
              </dl>
            </div>

            {/* QR code (when the ticket is already active — free events) */}
            {hasQR && !isPaidPending && (
              <>
                <Perforation />
                <div className="flex flex-col items-center bg-white px-6 pt-6 pb-5 text-[#141b2d]">
                  <QRCodeSVG value={registrationResult.ticket.qrCode} size={180} />
                  <p className="mt-3 text-[13px] text-[#565c6b]">Show this QR at the venue for check-in.</p>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm sm:px-6">
              <span className="text-muted-foreground">Registration #</span>
              <span className="font-mono text-[13px] font-medium">{registrationResult.registrationNumber}</span>
            </div>
          </article>

          {/* What happens next */}
          <section aria-labelledby="next-heading" className="rounded-lg border bg-card p-5">
            <h2 id="next-heading" className="text-sm font-semibold">What happens next</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>Confirmation email sent{session?.user?.email ? ` to ${session.user.email}` : ""}.</span></li>
              {isPaidPending && (
                <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>Complete your payment above to confirm your seat{fmtHoldTime(holdExpiresAt) ? ` — it's held until ${fmtHoldTime(holdExpiresAt)}` : ""}.</span></li>
              )}
              {formConfig.approvalRequired && (
                <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>The organizer will review your registration and email you once approved.</span></li>
              )}
              {guestTicketUrl && (
                <li className="flex gap-2.5"><Ticket className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>Your ticket link is below. We&apos;ve emailed it too, and it stays saved on this device.</span></li>
              )}
              {!guestTicketUrl && !isPaidPending && !formConfig.approvalRequired && (
                <li className="flex gap-2.5"><Ticket className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>Your ticket is in <Link href="/dashboard/tickets" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">My Tickets</Link> — save it to your calendar so you don&apos;t miss it.</span></li>
              )}
              {formConfig.contactEmail && (
                <li className="flex gap-2.5"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>Questions? Contact the organizer at <a href={`mailto:${formConfig.contactEmail}`} className="font-medium text-foreground underline underline-offset-4 hover:text-brand">{formConfig.contactEmail}</a>.</span></li>
              )}
            </ul>
          </section>

          {/* A guest has no dashboard: the private ticket link, shown and kept */}
          {guestTicketUrl && (
            <section aria-labelledby="guest-link-heading" className="space-y-3 rounded-lg border bg-card p-5">
              <div>
                <h2 id="guest-link-heading" className="text-sm font-semibold">Your ticket link</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Opens your ticket (QR code and PDF) anytime, without an account. Keep it private: anyone with the link can show your ticket.
                </p>
              </div>
              <div className="flex gap-2">
                <Input readOnly value={guestTicketUrl} aria-label="Your ticket link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-[13px]" />
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(guestTicketUrl)
                      toast.success("Ticket link copied")
                    } catch {
                      toast.error("Copy failed: select the link and copy it")
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
              <Link href="/forgot-password" className="inline-block text-[13px] font-medium text-foreground underline underline-offset-4 hover:text-brand">
                Set a password to manage your tickets
              </Link>
            </section>
          )}

          {/* Actions */}
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            <a href={buildIcs()} download={`${formConfig.slug}.ics`} className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2")}>
              <Calendar className="size-4" /> Add to calendar
            </a>
            {guestTicketPath ? (
              <a href={guestTicketPath} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2")}>
                <Ticket className="size-4" /> Open my ticket
              </a>
            ) : hasQR && registrationResult.ticket?.id ? (
              <a href={`/api/tickets/${registrationResult.ticket.id}/download`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2")}>
                <Ticket className="size-4" /> Download ticket
              </a>
            ) : (
              <Link href="/dashboard/tickets" className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2")}>
                <Ticket className="size-4" /> View my tickets
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:justify-center sm:gap-2">
            <Button
              variant="ghost"
              className="gap-2 text-muted-foreground"
              onClick={async () => {
                const url = `${window.location.origin}/events/${formConfig.slug}`
                const shareData = { title: formConfig.title, text: `I'm going to ${formConfig.title}!`, url }
                if (typeof navigator !== "undefined" && navigator.share) {
                  try { await navigator.share(shareData) } catch { /* user cancelled */ }
                } else {
                  await navigator.clipboard.writeText(url)
                  toast.success("Event link copied")
                }
              }}
            >
              <Share2 className="size-4" /> Share with friends
            </Button>
            <Link href="/events" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
              Browse more events
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const showQuantity = !!selectedTicket && selectedTicket.maxPerUser > 1
  const showCoupon = formConfig.isPaid && !!selectedTicket && selectedTicket.price > 0
  // Paid tickets need an account (checkout is tied to a session): tell guests at selection
  // time, not on Review.
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/events/${slug}/register`)}`
  const guestNeedsSignIn = isGuest && !!selectedTicket && selectedTicket.price > 0
  const where = formConfig.isOnline ? (formConfig.onlinePlatform || "Online") : (formConfig.venue || formConfig.venueCity || "Venue TBA")
  const money = (n: number) => `₹${n.toLocaleString("en-IN")}`

  return (
    <div className={cn(SHELL, "max-w-[1104px] pt-6 pb-16 lg:pt-8 lg:pb-24")}>
      <Link href={`/events/${slug}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-sm text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> Back to event
      </Link>

      <div className="mt-2">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em] text-balance">Register · {formConfig.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {formatInZone(formConfig.startDate, formConfig.timezone, { weekday: "short", day: "numeric", month: "short" })} · {where}
        </p>
      </div>

      {isGuest && savedGuestLink && (
        <p role="status" className="mt-4 rounded-lg border bg-card px-4 py-3 text-sm">
          You already registered for this event on this device.{" "}
          <a href={savedGuestLink} className="font-medium underline underline-offset-4 hover:text-brand">Open your ticket</a>
        </p>
      )}

      {/* Step indicator */}
      <ol className="mt-6 flex items-center gap-3" aria-label="Registration steps">
        {STEPS.map((s, i) => {
          const done = stepIndex > i
          const active = step === s.id
          return (
            <li key={s.id} className={cn("flex items-center gap-3", i < STEPS.length - 1 && "flex-1 sm:flex-none")} aria-current={active ? "step" : undefined}>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                    active || done ? "bg-primary text-primary-foreground" : "border border-input text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className={cn("text-sm whitespace-nowrap", active ? "font-medium text-foreground" : "text-muted-foreground", !active && "max-sm:sr-only")}>
                  {s.label}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </span>
              {i < STEPS.length - 1 && <span aria-hidden className={cn("h-px min-w-4 flex-1 sm:w-10 sm:flex-none", done ? "bg-foreground" : "bg-border")} />}
            </li>
          )
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {/* STEP: Ticket */}
          {step === "ticket" && (
            <div className="rounded-lg border bg-card p-5 sm:p-6">
              <fieldset>
                <legend className="text-base font-semibold">Choose your ticket</legend>
                <div className="mt-4 space-y-2.5">
                  {formConfig.ticketTypes.map((ticket) => {
                    const selected = selectedTicketId === ticket.id
                    return (
                      <label
                        key={ticket.id}
                        className={cn(
                          "flex min-h-16 items-center gap-3.5 rounded-lg border bg-card px-4 py-3.5 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
                          ticket.isSoldOut
                            ? "cursor-not-allowed bg-raised text-muted-foreground"
                            : selected
                              ? "cursor-pointer border-primary ring-1 ring-primary"
                              : "cursor-pointer hover:border-input"
                        )}
                      >
                        <input
                          type="radio"
                          name="ticket-type"
                          value={ticket.id}
                          checked={selected}
                          disabled={ticket.isSoldOut}
                          onChange={() => setSelectedTicketId(ticket.id)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "size-[18px] shrink-0 rounded-full border transition-[border-width,border-color] duration-150",
                            selected ? "border-[5px] border-primary" : "border-input",
                            ticket.isSoldOut && "opacity-50"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{ticket.name}</span>
                          {ticket.description && <span className="mt-0.5 block text-[13px] text-muted-foreground">{ticket.description}</span>}
                          {isGuest && ticket.price > 0 && !ticket.isSoldOut && (
                            <a href={loginHref} className="mt-0.5 inline-block text-[13px] font-medium text-foreground underline underline-offset-4 hover:text-brand">
                              Sign in to buy
                            </a>
                          )}
                          {ticket.remaining !== null && ticket.remaining <= 10 && ticket.remaining > 0 && (
                            <span className={cn("mt-0.5 block text-[13px] tabular-nums", ticket.remaining <= 5 ? "text-destructive" : "text-muted-foreground")}>
                              Only {ticket.remaining} left
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2.5">
                          {ticket.isSoldOut && <Pill tone="neutral">Sold out</Pill>}
                          <span className="text-sm font-semibold tabular-nums">{ticket.price > 0 ? money(ticket.price) : "Free"}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {(showQuantity || showCoupon) && (
                <div className="mt-6 grid gap-5 border-t border-rule pt-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
                  {/* Quantity Selector */}
                  {showQuantity && selectedTicket && (
                    <div>
                      <p id="qty-label" className="text-sm font-medium">Quantity</p>
                      <div role="group" aria-labelledby="qty-label" className="mt-2 inline-flex items-center rounded-md border border-input">
                        <Button variant="ghost" size="icon" className="rounded-r-none" aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-10 text-center text-sm font-medium tabular-nums" aria-live="polite">{quantity}</span>
                        <Button variant="ghost" size="icon" className="rounded-l-none" aria-label="Increase quantity" onClick={() => setQuantity(Math.min(selectedTicket.maxPerUser, quantity + 1))} disabled={quantity >= selectedTicket.maxPerUser}>
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Coupon */}
                  {showCoupon && (
                    <div className="min-w-0">
                      <Label htmlFor="coupon-code">Coupon code</Label>
                      <div className="mt-2 flex gap-2">
                        <Input id="coupon-code" placeholder="Enter code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={couponApplied} className="font-mono placeholder:font-sans" />
                        {couponApplied ? (
                          <Button variant="outline" onClick={() => { setCouponApplied(false); setCouponDiscount(0); setCouponCode("") }}>Remove</Button>
                        ) : (
                          <Button variant="outline" onClick={handleApplyCoupon}>Apply</Button>
                        )}
                      </div>
                      {couponApplied && <p className="mt-2 text-[13px] text-positive tabular-nums">Discount: ₹{couponDiscount.toLocaleString("en-IN")}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP: Details */}
          {step === "details" && (
            <div className="rounded-lg border bg-card p-5 sm:p-6">
              <h2 className="text-base font-semibold">Your details</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">Fields marked * are required.</p>
              {isGuest && (
                <p className="mt-3 rounded-md border border-rule bg-raised px-3.5 py-3 text-[13px] text-muted-foreground">
                  Registering as a guest. <a href={`/login?callbackUrl=/events/${slug}/register`} className="font-medium text-foreground underline underline-offset-4 hover:text-brand">Sign in</a> to save your tickets to your dashboard.
                </p>
              )}
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailField id="reg-name" label="Full name" required error={detailErrors.name}>
                  <Input id="reg-name" autoComplete="name" {...fieldA11y("reg-name", detailErrors.name)} {...form.register("name")} />
                </DetailField>
                <DetailField id="reg-email" label="Email" required error={detailErrors.email}>
                  <Input id="reg-email" type="email" autoComplete="email" {...fieldA11y("reg-email", detailErrors.email)} {...form.register("email")} disabled={!isGuest} className={!isGuest ? "bg-muted" : ""} placeholder={isGuest ? "your@email.com" : ""} />
                </DetailField>
              </div>
              {defaultFields.phone !== "hidden" && (
                <DetailField id="reg-phone" label="Phone" required={defaultFields.phone === "required"} error={detailErrors.phone} className="mt-5">
                  <Input id="reg-phone" type="tel" autoComplete="tel" placeholder="+91 9876543210" {...fieldA11y("reg-phone", detailErrors.phone)} {...form.register("phone")} />
                </DetailField>
              )}
              {(defaultFields.organization !== "hidden" || defaultFields.department !== "hidden") && (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {defaultFields.organization !== "hidden" && (
                    <DetailField id="reg-organization" label="Organization / institution" required={defaultFields.organization === "required"} error={detailErrors.organization}>
                      <Input id="reg-organization" autoComplete="organization" {...fieldA11y("reg-organization", detailErrors.organization)} {...form.register("organization")} />
                    </DetailField>
                  )}
                  {defaultFields.department !== "hidden" && (
                    <DetailField id="reg-department" label="Department" required={defaultFields.department === "required"} error={detailErrors.department}>
                      <Input id="reg-department" {...fieldA11y("reg-department", detailErrors.department)} {...form.register("department")} />
                    </DetailField>
                  )}
                </div>
              )}

              {formConfig.customFields.length > 0 && (
                <div className="mt-6 border-t border-rule pt-6">
                  <RegistrationForm
                    fields={formConfig.customFields}
                    form={form}
                    canUpload={authStatus === "authenticated"}
                    errors={Object.fromEntries(Object.entries(detailErrors).filter(([k]) => k.startsWith("customFields.")).map(([k, v]) => [k.slice("customFields.".length), v]))}
                  />
                </div>
              )}

              {formConfig.termsAndConditions && (
                <div className="mt-6 border-t border-rule pt-5">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="terms"
                      className="mt-0.5"
                      checked={form.watch("agreeToTerms")}
                      onCheckedChange={(v) => form.setValue("agreeToTerms", !!v)}
                      {...fieldA11y("terms", detailErrors.agreeToTerms)}
                    />
                    <label htmlFor="terms" className="cursor-pointer text-[13px] text-muted-foreground">
                      I agree to the event&apos;s Terms & Conditions <span className="text-muted-foreground">*</span>
                    </label>
                  </div>
                  <details className="mt-2 pl-[26px] text-[13px] text-muted-foreground">
                    <summary className="w-fit cursor-pointer underline-offset-4 hover:text-foreground hover:underline">Read the terms</summary>
                    <p className="mt-2 max-h-48 overflow-y-auto rounded-md border border-rule bg-raised px-3.5 py-3 leading-relaxed whitespace-pre-line">{formConfig.termsAndConditions}</p>
                  </details>
                  {detailErrors.agreeToTerms && <p id="terms-error" className="mt-2 text-[13px] text-destructive">{detailErrors.agreeToTerms}</p>}
                </div>
              )}
            </div>
          )}

          {/* STEP: Review */}
          {step === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-5 sm:p-6">
                <h2 className="text-base font-semibold">Review your registration</h2>
                <dl className="mt-3 divide-y divide-rule text-sm">
                  <ReviewRow label="Event">{formConfig.title}</ReviewRow>
                  <ReviewRow label="Ticket">{selectedTicket?.name}</ReviewRow>
                  <ReviewRow label="Price"><span className="font-semibold tabular-nums">₹{total.toLocaleString("en-IN")}</span></ReviewRow>
                  <ReviewRow label="Name">{form.getValues("name")}</ReviewRow>
                  <ReviewRow label="Email">{form.getValues("email")}</ReviewRow>
                  {defaultFields.phone !== "hidden" && form.getValues("phone") && <ReviewRow label="Phone"><span className="tabular-nums">{form.getValues("phone")}</span></ReviewRow>}
                  {defaultFields.organization !== "hidden" && form.getValues("organization") && <ReviewRow label="Organization">{form.getValues("organization")}</ReviewRow>}
                  {defaultFields.department !== "hidden" && form.getValues("department") && <ReviewRow label="Department">{form.getValues("department")}</ReviewRow>}
                  {formConfig.customFields.map((field: { id: string; label: string }) => {
                    const answer = reviewAnswer(form.getValues("customFields")[field.id])
                    return answer ? <ReviewRow key={field.id} label={field.label}>{answer}</ReviewRow> : null
                  })}
                </dl>
              </div>

              {formConfig.approvalRequired && (
                <p className="flex items-start gap-2.5 rounded-md bg-pill-warning px-3.5 py-3 text-[13px] text-pill-warning-foreground">
                  <Clock className="mt-px size-4 shrink-0" aria-hidden />
                  This event requires organizer approval. Your registration will be reviewed.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary: the order so far and the step's one action */}
        <aside aria-labelledby="summary-heading" className="rounded-lg border bg-card p-5 sm:p-6 lg:sticky lg:top-[88px]">
          <h2 id="summary-heading" className="text-base font-semibold">Summary</h2>
          {selectedTicket ? (
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{selectedTicket.name} × {quantity}</span>
                <span className="tabular-nums">{selectedTicket.price > 0 ? money(subtotal) : "Free"}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between gap-4 text-positive">
                  <span>Discount</span>
                  <span className="tabular-nums">-₹{couponDiscount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
                <span className="font-semibold">Total</span>
                <span className="text-[22px] leading-7 font-semibold tracking-[-0.015em] tabular-nums">{money(total)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Choose a ticket to see your total.</p>
          )}

          <div className="mt-5 space-y-2">
            {step === "ticket" && (
              <Button className="h-11 w-full gap-1.5 text-[15px]" disabled={!selectedTicketId || guestNeedsSignIn} onClick={() => setStep("details")}>
                Continue
              </Button>
            )}
            {step === "details" && (
              <>
                <Button className="h-11 w-full gap-1.5 text-[15px]" onClick={continueToReview}>
                  Continue
                </Button>
                <Button variant="ghost" onClick={() => setStep("ticket")} className="w-full gap-1.5 text-muted-foreground">
                  <ArrowLeft className="size-4" /> Back
                </Button>
              </>
            )}
            {step === "review" && (
              <>
                <Button className="h-11 w-full gap-2 text-[15px]" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {total > 0 ? `Pay ₹${total.toLocaleString("en-IN")}` : "Confirm registration"}
                </Button>
                <Button variant="ghost" onClick={() => setStep("details")} className="w-full gap-1.5 text-muted-foreground">
                  <ArrowLeft className="size-4" /> Back
                </Button>
              </>
            )}
          </div>

          {step === "ticket" && (guestNeedsSignIn ? (
            <p className="mt-4 text-[13px] text-muted-foreground" role="status">
              Paid tickets need an account.{" "}
              <a href={loginHref} className="font-medium text-foreground underline underline-offset-4 hover:text-brand">Sign in</a>{" "}
              to buy this ticket, or choose a free one.
            </p>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">You can check everything on the review step before you confirm.</p>
          ))}
          {step === "review" && isGuest && total > 0 && (
            <p className="mt-4 text-[13px] text-muted-foreground">
              Paid tickets need an account.{" "}
              <a href={`/login?callbackUrl=/events/${slug}/register`} className="font-medium text-foreground underline underline-offset-4 hover:text-brand">Sign in</a>{" "}
              to buy this ticket.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

const SHELL = "mx-auto w-full max-w-[1240px] px-5 sm:px-8"

const STEPS: { id: RegStep; label: string }[] = [
  { id: "ticket", label: "Ticket" },
  { id: "details", label: "Your details" },
  { id: "review", label: "Review" },
]

// Where to move focus for each built-in field's error
const DETAIL_FIELD_IDS: Record<string, string> = {
  name: "reg-name",
  email: "reg-email",
  phone: "reg-phone",
  organization: "reg-organization",
  department: "reg-department",
  agreeToTerms: "terms",
}

const fieldA11y = (id: string, error?: string) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
})

/** A built-in details field: label (with * when required), the control, and its error line. */
function DetailField({ id, label, required, error, className, children }: {
  id: string
  label: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="-ml-1 text-muted-foreground">*</span>}
      </Label>
      {children}
      {error && <p id={`${id}-error`} className="text-[13px] text-destructive">{error}</p>}
    </div>
  )
}

/** A custom answer as review text; empty answers are left out. */
function reviewAnswer(value: unknown): string | null {
  if (value === true) return "Yes"
  if (Array.isArray(value)) return value.length ? value.join(", ") : null
  // a FILE_UPLOAD answer is the uploaded file's URL
  if (isUploadedFileUrl(value)) return "File attached"
  if (typeof value === "string") return value.trim() || null
  if (typeof value === "number") return String(value)
  return null
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

/** The ticket's tear line: a dashed rule with notches cut from each edge. */
function Perforation() {
  return (
    <div className="relative h-0 border-t-2 border-dashed border-border" aria-hidden>
      <span className="absolute -top-[9px] -left-[9px] size-4 rounded-full border border-border bg-background" />
      <span className="absolute -top-[9px] -right-[9px] size-4 rounded-full border border-border bg-background" />
    </div>
  )
}

function RegisterSkeleton() {
  return (
    <div className={cn(SHELL, "max-w-[1104px] pt-6 pb-16 lg:pt-8")} aria-busy="true" aria-label="Loading registration">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-7 w-2/3 max-w-md" />
      <Skeleton className="mt-2 h-4 w-48" />
      <Skeleton className="mt-6 h-6 w-72" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="space-y-2.5 rounded-lg border p-5 sm:p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </div>
  )
}
