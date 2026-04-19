"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import {
  ArrowLeft, ChevronRight, Check, Loader2, Calendar, MapPin,
  Copy, CheckCircle, Ticket, Share2,
} from "lucide-react"

import { motion } from "framer-motion"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { RegistrationForm } from "@/components/registration/RegistrationForm"
import { Stagger, StaggerItem } from "@/components/motion/primitives"
import { cn } from "@/lib/utils"

type RegStep = "ticket" | "details" | "review" | "success"

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

  const form = useForm({
    defaultValues: {
      name: session?.user?.name || "",
      email: session?.user?.email || "",
      phone: "",
      agreeToTerms: false,
      customFields: {} as Record<string, unknown>,
    },
  })

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

  const handleSubmit = async () => {
    if (!formConfig || !selectedTicketId) return
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
            name: values.name,
            phone: values.phone,
            ...values.customFields,
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
      setStep("success")
      toast.success("Registration successful!")
    } catch {
      toast.error("Registration failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authStatus === "loading" || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!formConfig) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Event not found or registration is not available.</p>
        <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Browse Events</Link>
      </div>
    )
  }

  // SUCCESS SCREEN
  if (step === "success" && registrationResult) {
    const startDate = new Date(formConfig.startDate)
    const endDate = new Date(formConfig.endDate)
    const sameDay = formConfig.startDate.slice(0, 10) === formConfig.endDate.slice(0, 10)
    const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    const isPaidPending = registrationResult.payment && registrationResult.payment.status === "PENDING"
    const hasQR = !!registrationResult.ticket?.qrCode
    const locationLine = formConfig.isOnline
      ? `${formConfig.onlinePlatform || "Online"} \u00B7 link will be emailed`
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

    return (
      <Stagger className="container mx-auto px-4 py-10 max-w-xl space-y-6">
        <StaggerItem className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 15 }}
            >
              <CheckCircle className="h-8 w-8 text-green-600" />
            </motion.div>
          </motion.div>
          <h1 className="text-2xl font-bold">
            {formConfig.approvalRequired
              ? "Registration Submitted"
              : isPaidPending
                ? "Almost done — complete your payment"
                : "You're Registered!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            A confirmation has been sent to your email.
          </p>
        </StaggerItem>

        {/* What you registered for */}
        <StaggerItem><Card className="p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">You're going to</p>
            <p className="font-semibold text-lg mt-0.5">{formConfig.title}</p>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{fmtDate(startDate)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtTime(startDate)} &ndash; {sameDay ? fmtTime(endDate) : `${fmtDate(endDate)}, ${fmtTime(endDate)}`}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">{locationLine}</p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Registration #</span>
            <span className="font-mono font-medium">{registrationResult.registrationNumber}</span>
          </div>
        </Card></StaggerItem>

        {/* QR code (when the ticket is already active — free events) */}
        {hasQR && !isPaidPending && (
          <StaggerItem><Card className="p-5 space-y-3 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your ticket</p>
            <div className="flex justify-center py-2">
              <QRCodeSVG value={registrationResult.ticket.qrCode} size={180} />
            </div>
            <p className="text-xs text-muted-foreground">
              Show this QR at the venue for check-in.
            </p>
          </Card></StaggerItem>
        )}

        {/* What happens next */}
        <StaggerItem><Card className="p-5 space-y-2">
          <p className="text-sm font-medium">What happens next</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> Confirmation email sent{session?.user?.email ? ` to ${session.user.email}` : ""}.</li>
            {isPaidPending && (
              <li className="flex gap-2"><Check className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> Complete your payment from <Link href="/dashboard/payments" className="text-primary hover:underline">Payments</Link> to confirm your seat.</li>
            )}
            {formConfig.approvalRequired && (
              <li className="flex gap-2"><Check className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> The organizer will review your registration and email you once approved.</li>
            )}
            {!isPaidPending && !formConfig.approvalRequired && (
              <li className="flex gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> Your ticket is in <Link href="/dashboard/tickets" className="text-primary hover:underline">My Tickets</Link> — save it to your calendar so you don't miss it.</li>
            )}
            {formConfig.contactEmail && (
              <li className="flex gap-2"><Check className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /> Questions? Contact the organizer at <a href={`mailto:${formConfig.contactEmail}`} className="text-primary hover:underline">{formConfig.contactEmail}</a>.</li>
            )}
          </ul>
        </Card></StaggerItem>

        {/* Primary actions */}
        <StaggerItem className="grid gap-2 sm:grid-cols-2">
          <a href={buildIcs()} download={`${formConfig.slug}.ics`} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <Calendar className="h-4 w-4" /> Add to Calendar
          </a>
          {hasQR && registrationResult.ticket?.id ? (
            <a href={`/api/tickets/${registrationResult.ticket.id}/download`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <Ticket className="h-4 w-4" /> Download Ticket
            </a>
          ) : (
            <Link href="/dashboard/tickets" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <Ticket className="h-4 w-4" /> View My Tickets
            </Link>
          )}
        </StaggerItem>

        {/* Share / secondary */}
        <StaggerItem className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
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
            <Share2 className="h-4 w-4" /> Share with friends
          </Button>
          <Link href="/events" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}>
            Browse more events
          </Link>
        </StaggerItem>
      </Stagger>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href={`/events/${slug}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to event
      </Link>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(["ticket", "details", "review"] as RegStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
              step === s ? "bg-primary text-primary-foreground" :
              (["ticket", "details", "review"].indexOf(step) > i) ? "bg-primary/10 text-primary" :
              "bg-muted text-muted-foreground"
            )}>
              {["ticket", "details", "review"].indexOf(step) > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < 2 && <div className={cn("h-0.5 w-8", ["ticket", "details", "review"].indexOf(step) > i ? "bg-primary" : "bg-muted")} />}
          </div>
        ))}
      </div>

      {/* STEP: Ticket Selection */}
      {step === "ticket" && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Choose Your Ticket</h2>
          <div className="space-y-3">
            {formConfig.ticketTypes.map((ticket) => (
              <button
                key={ticket.id}
                disabled={ticket.isSoldOut}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg border p-4 text-left transition-colors",
                  selectedTicketId === ticket.id ? "border-primary bg-primary/5" : "hover:border-primary/50",
                  ticket.isSoldOut && "opacity-50 cursor-not-allowed"
                )}
              >
                <div>
                  <p className="font-medium">{ticket.name}</p>
                  {ticket.description && <p className="text-xs text-muted-foreground">{ticket.description}</p>}
                  {ticket.remaining !== null && ticket.remaining <= 10 && ticket.remaining > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Only {ticket.remaining} left!</p>
                  )}
                  {ticket.isSoldOut && <Badge variant="secondary" className="mt-1">Sold Out</Badge>}
                </div>
                <p className="font-semibold">{ticket.price > 0 ? `₹${ticket.price.toLocaleString("en-IN")}` : "Free"}</p>
              </button>
            ))}
          </div>

          {/* Coupon */}
          {formConfig.isPaid && selectedTicket && selectedTicket.price > 0 && (
            <div className="space-y-2">
              <Label>Coupon Code</Label>
              <div className="flex gap-2">
                <Input placeholder="Enter code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={couponApplied} />
                {couponApplied ? (
                  <Button variant="outline" onClick={() => { setCouponApplied(false); setCouponDiscount(0); setCouponCode("") }}>Remove</Button>
                ) : (
                  <Button variant="outline" onClick={handleApplyCoupon}>Apply</Button>
                )}
              </div>
              {couponApplied && <p className="text-xs text-green-600">Discount: ₹{couponDiscount.toLocaleString("en-IN")}</p>}
            </div>
          )}

          {/* Quantity Selector */}
          {selectedTicket && selectedTicket.maxPerUser > 1 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Quantity</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-8 w-8 rounded-md border text-center hover:bg-accent" disabled={quantity <= 1}>−</button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(selectedTicket.maxPerUser, quantity + 1))} className="h-8 w-8 rounded-md border text-center hover:bg-accent" disabled={quantity >= selectedTicket.maxPerUser}>+</button>
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedTicket && (
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{selectedTicket.name} × {quantity}</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
              {couponDiscount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{couponDiscount.toLocaleString("en-IN")}</span></div>}
              <Separator />
              <div className="flex justify-between font-semibold"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
            </div>
          )}

          <Button className="w-full" disabled={!selectedTicketId} onClick={() => setStep("details")}>
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Card>
      )}

      {/* STEP: Details */}
      {step === "details" && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Your Details</h2>
          {isGuest && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-400">
              Registering as a guest. <a href={`/login?callbackUrl=/events/${slug}/register`} className="font-medium underline">Sign in</a> to save your tickets to your dashboard.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" {...form.register("email")} disabled={!isGuest} className={!isGuest ? "bg-muted" : ""} placeholder={isGuest ? "your@email.com" : ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" placeholder="+91 9876543210" {...form.register("phone")} />
          </div>

          {formConfig.customFields.length > 0 && (
            <>
              <Separator />
              <RegistrationForm fields={formConfig.customFields} form={form} />
            </>
          )}

          {formConfig.termsAndConditions && (
            <>
              <Separator />
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={form.watch("agreeToTerms")}
                  onCheckedChange={(v) => form.setValue("agreeToTerms", !!v)}
                />
                <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">
                  I agree to the event&apos;s Terms & Conditions
                </label>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("ticket")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button className="flex-1" onClick={() => setStep("review")}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP: Review */}
      {step === "review" && (
        <div className="space-y-4">
          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">Review Your Registration</h2>

            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span className="font-medium">{formConfig.title}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Ticket</span><span>{selectedTicket?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-semibold">₹{total.toLocaleString("en-IN")}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{form.getValues("name")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{form.getValues("email")}</span></div>
              {form.getValues("phone") && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{form.getValues("phone")}</span></div>}
            </div>
          </Card>

          {formConfig.approvalRequired && (
            <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              This event requires organizer approval. Your registration will be reviewed.
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("details")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {total > 0 ? `Pay ₹${total.toLocaleString("en-IN")}` : "Confirm Registration"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
