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

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { RegistrationForm } from "@/components/registration/RegistrationForm"
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
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">
          {formConfig.approvalRequired ? "Registration Submitted!" : "You're Registered!"}
        </h1>
        <p className="text-muted-foreground">
          {formConfig.approvalRequired
            ? "Your registration is pending approval. You'll receive an email once approved."
            : `See you at ${formConfig.title}!`}
        </p>
        <Card className="p-6 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Registration #</span>
            <span className="font-mono font-medium">{registrationResult.registrationNumber}</span>
          </div>
          <Separator />
          {registrationResult.ticket && (
            <div className="flex justify-center py-4">
              <QRCodeSVG value={registrationResult.ticket.qrCode} size={160} />
            </div>
          )}
        </Card>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard/tickets" className={cn(buttonVariants(), "gap-2")}>
            <Ticket className="h-4 w-4" /> View My Tickets
          </Link>
          <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            Browse More Events
          </Link>
        </div>
      </div>
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
