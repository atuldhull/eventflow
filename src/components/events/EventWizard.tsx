"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import {
  Check, ChevronLeft, ChevronRight, Save, Loader2, Plus, Trash2, GripVertical,
  Upload, Calendar, MapPin, Globe, Monitor, Eye,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/utils"
import { useRBAC } from "@/hooks/useRBAC"
import type {
  EventBasicInput,
  EventDateInput,
  EventTicketsInput,
  EventFormInput,
  EventMediaInput,
  TicketTypeInput,
  CustomFormFieldInput,
} from "@/lib/validations/event"

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Date & Venue" },
  { id: 3, label: "Tickets" },
  { id: 4, label: "Registration Form" },
  { id: 5, label: "Media & Details" },
  { id: 6, label: "Review & Publish" },
]

const EVENT_TYPES = [
  { value: "SINGLE", label: "Single Event", description: "One-time event on a single day", icon: Calendar },
  { value: "MULTI_DAY", label: "Multi-Day", description: "Spans multiple days", icon: Calendar },
  { value: "VIRTUAL", label: "Virtual", description: "Fully online event", icon: Monitor },
  { value: "HYBRID", label: "Hybrid", description: "Both in-person and online", icon: Globe },
]

const CATEGORIES = [
  "TECH", "CULTURAL", "SPORTS", "WORKSHOP", "HACKATHON", "CONFERENCE",
  "SEMINAR", "WEBINAR", "FEST", "COMPETITION", "MEETUP", "OTHER",
]

const VISIBILITIES = [
  { value: "PUBLIC", label: "Public", description: "Anyone can discover and register" },
  { value: "PRIVATE", label: "Private", description: "Only accessible via direct link" },
  { value: "INVITE_ONLY", label: "Invite Only", description: "Only invited users can register" },
  { value: "UNLISTED", label: "Unlisted", description: "Not shown in search, link required" },
]

const FIELD_TYPES = [
  { value: "TEXT", label: "Short Text" },
  { value: "TEXTAREA", label: "Long Text" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown" },
  { value: "MULTI_SELECT", label: "Multi-Select" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "RADIO", label: "Radio Buttons" },
  { value: "FILE_UPLOAD", label: "File Upload" },
  { value: "URL", label: "URL" },
]

// Combined form schema for the wizard
const wizardSchema = z.object({
  // Step 1
  title: z.string().min(3, "Min 3 characters").max(150),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens only"),
  shortDescription: z.string().min(10, "Min 10 characters").max(200),
  description: z.string().min(50, "Min 50 characters").max(5000),
  type: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  tags: z.array(z.string()).default([]),
  visibility: z.string().min(1, "Required"),
  // Step 2
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  timezone: z.string().default("Asia/Kolkata"),
  registrationStartDate: z.string().optional().or(z.literal("")),
  registrationEndDate: z.string().optional().or(z.literal("")),
  isOnline: z.boolean().default(false),
  venue: z.string().optional().or(z.literal("")),
  venueAddress: z.string().optional().or(z.literal("")),
  venueCity: z.string().optional().or(z.literal("")),
  venueState: z.string().optional().or(z.literal("")),
  venueCountry: z.string().optional().or(z.literal("")),
  onlinePlatform: z.string().optional().or(z.literal("")),
  onlineLink: z.string().optional().or(z.literal("")),
  // Step 3
  isPaid: z.boolean().default(false),
  maxCapacity: z.string().optional().or(z.literal("")),
  waitlistEnabled: z.boolean().default(false),
  approvalRequired: z.boolean().default(false),
  allowTeamRegistration: z.boolean().default(false),
  minTeamSize: z.string().optional().or(z.literal("")),
  maxTeamSize: z.string().optional().or(z.literal("")),
  // Step 5
  coverImage: z.string().optional().or(z.literal("")),
  rules: z.string().optional().or(z.literal("")),
  termsAndConditions: z.string().optional().or(z.literal("")),
  refundPolicy: z.string().optional().or(z.literal("")),
  contactEmail: z.string().optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  seoTitle: z.string().optional().or(z.literal("")),
  seoDescription: z.string().optional().or(z.literal("")),
})

type WizardFormData = z.infer<typeof wizardSchema>

interface EventWizardProps {
  orgId: string
  initialData?: Partial<WizardFormData> & {
    id?: string
    ticketTypes?: TicketTypeInput[]
    customFormFields?: CustomFormFieldInput[]
  }
  mode?: "create" | "edit"
}

export function EventWizard({ orgId, initialData, mode = "create" }: EventWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>(
    initialData?.ticketTypes || [{ name: "General Admission", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }]
  )
  const [customFields, setCustomFields] = useState<CustomFormFieldInput[]>(initialData?.customFormFields || [])
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([])
  const [sponsors, setSponsors] = useState<{ name: string; tier: string; website: string }[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    getValues,
    formState: { errors, isDirty },
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
      timezone: "Asia/Kolkata",
      isOnline: false,
      isPaid: false,
      waitlistEnabled: false,
      approvalRequired: false,
      allowTeamRegistration: false,
      contactEmail: "",
      ...initialData,
    },
  })

  const title = watch("title")
  const isPaid = watch("isPaid")
  const isOnline = watch("isOnline")
  const eventType = watch("type")

  // Auto-generate slug from title
  useEffect(() => {
    if (mode === "create" && title) {
      setValue("slug", slugify(title))
    }
  }, [title, mode, setValue])

  const validateStep = async (stepNum: number): Promise<boolean> => {
    const fieldsPerStep: Record<number, (keyof WizardFormData)[]> = {
      1: ["title", "slug", "shortDescription", "description", "type", "category", "visibility"],
      2: ["startDate", "endDate", "timezone"],
      3: [],
      4: [],
      5: [],
      6: [],
    }
    const fields = fieldsPerStep[stepNum] || []
    if (fields.length === 0) return true
    return trigger(fields)
  }

  const goNext = async () => {
    const valid = await validateStep(step)
    if (valid && step < 6) setStep(step + 1)
  }

  const goBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const saveAsDraft = async () => {
    setIsSaving(true)
    try {
      const values = getValues()
      const payload = {
        ...values,
        startDate: values.startDate ? new Date(values.startDate) : new Date(),
        endDate: values.endDate ? new Date(values.endDate) : new Date(),
        registrationStartDate: values.registrationStartDate ? new Date(values.registrationStartDate) : undefined,
        registrationEndDate: values.registrationEndDate ? new Date(values.registrationEndDate) : undefined,
        maxCapacity: values.maxCapacity ? parseInt(values.maxCapacity) : undefined,
        minTeamSize: values.minTeamSize ? parseInt(values.minTeamSize) : undefined,
        maxTeamSize: values.maxTeamSize ? parseInt(values.maxTeamSize) : undefined,
        ticketTypes,
        customFormFields: customFields,
        faqs,
        sponsors: sponsors.map((s, i) => ({ ...s, sortOrder: i })),
        sessions: [],
        gallery: [],
        seoKeywords: [],
        status: "DRAFT",
      }

      const url = mode === "edit" && initialData?.id
        ? `/api/admin/org/${orgId}/events/${initialData.id}`
        : `/api/admin/org/${orgId}/events`
      const method = mode === "edit" && initialData?.id ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!result.success) {
        toast.error(result.message || "Failed to save")
        return
      }

      toast.success("Draft saved successfully")
      if (mode === "create") {
        router.push("/admin/org/events")
      }
    } catch {
      toast.error("Failed to save draft")
    } finally {
      setIsSaving(false)
    }
  }

  const publishEvent = async () => {
    // Validate all steps
    const allValid = await trigger()
    if (!allValid) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsPublishing(true)
    try {
      const values = getValues()
      const payload = {
        ...values,
        startDate: new Date(values.startDate),
        endDate: new Date(values.endDate),
        registrationStartDate: values.registrationStartDate ? new Date(values.registrationStartDate) : undefined,
        registrationEndDate: values.registrationEndDate ? new Date(values.registrationEndDate) : undefined,
        maxCapacity: values.maxCapacity ? parseInt(values.maxCapacity) : undefined,
        minTeamSize: values.minTeamSize ? parseInt(values.minTeamSize) : undefined,
        maxTeamSize: values.maxTeamSize ? parseInt(values.maxTeamSize) : undefined,
        ticketTypes,
        customFormFields: customFields,
        faqs,
        sponsors: sponsors.map((s, i) => ({ ...s, sortOrder: i })),
        sessions: [],
        gallery: [],
        seoKeywords: [],
        status: "PUBLISHED",
      }

      const url = mode === "edit" && initialData?.id
        ? `/api/admin/org/${orgId}/events/${initialData.id}`
        : `/api/admin/org/${orgId}/events`
      const method = mode === "edit" && initialData?.id ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!result.success) {
        toast.error(result.message || "Failed to publish")
        return
      }

      toast.success("Event published successfully!")
      router.push("/admin/org/events")
    } catch {
      toast.error("Failed to publish event")
    } finally {
      setIsPublishing(false)
    }
  }

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, {
      name: "", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: ticketTypes.length,
    }])
  }

  const removeTicketType = (index: number) => {
    setTicketTypes(ticketTypes.filter((_, i) => i !== index))
  }

  const updateTicketType = (index: number, field: string, value: unknown) => {
    const updated = [...ticketTypes]
    updated[index] = { ...updated[index], [field]: value }
    setTicketTypes(updated)
  }

  const addCustomField = (fieldType: string) => {
    setCustomFields([...customFields, {
      label: "", fieldType: fieldType as CustomFormFieldInput["fieldType"], isRequired: false, options: [], sortOrder: customFields.length,
    }])
  }

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  const updateCustomField = (index: number, field: string, value: unknown) => {
    const updated = [...customFields]
    updated[index] = { ...updated[index], [field]: value }
    setCustomFields(updated)
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1">
            <button
              onClick={() => s.id <= step && setStep(s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                s.id === step ? "bg-primary text-primary-foreground" :
                s.id < step ? "bg-primary/10 text-primary cursor-pointer" :
                "bg-muted text-muted-foreground"
              )}
            >
              {s.id < step ? <Check className="h-3 w-3" /> : <span>{s.id}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={cn("h-0.5 w-4", s.id < step ? "bg-primary" : "bg-muted")} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="max-w-3xl mx-auto">
        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Event Details</h3>
              <div className="space-y-2">
                <Label>Event Title *</Label>
                <Input placeholder="e.g., Tech Summit 2026" {...register("title")} />
                <div className="flex justify-between"><p className="text-xs text-destructive">{errors.title?.message}</p><span className="text-xs text-muted-foreground">{(watch("title") || "").length}/150</span></div>
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input placeholder="tech-summit-2026" {...register("slug")} />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Short Description *</Label>
                <Textarea placeholder="A brief one-liner..." rows={2} {...register("shortDescription")} />
                <div className="flex justify-between"><p className="text-xs text-destructive">{errors.shortDescription?.message}</p><span className="text-xs text-muted-foreground">{(watch("shortDescription") || "").length}/200</span></div>
              </div>
              <div className="space-y-2">
                <Label>Full Description *</Label>
                <Textarea placeholder="Detailed description of your event..." rows={6} {...register("description")} />
                <div className="flex justify-between"><p className="text-xs text-destructive">{errors.description?.message}</p><span className="text-xs text-muted-foreground">{(watch("description") || "").length}/5000</span></div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Classification</h3>
              <div className="space-y-2">
                <Label>Event Type *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {EVENT_TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => setValue("type", t.value)}
                      className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition-colors", watch("type") === t.value ? "border-primary bg-primary/5" : "hover:border-primary/50")}
                    >
                      <t.icon className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={watch("category")} onValueChange={(v) => setValue("category", v || "")}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Visibility *</Label>
                  <Select value={watch("visibility")} onValueChange={(v) => setValue("visibility", v || "PUBLIC")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{VISIBILITIES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* STEP 2: Date & Venue */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Event Schedule</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date & Time *</Label>
                  <Input type="datetime-local" {...register("startDate")} />
                  {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time *</Label>
                  <Input type="datetime-local" {...register("endDate")} />
                  {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Registration Opens</Label>
                  <Input type="datetime-local" {...register("registrationStartDate")} />
                </div>
                <div className="space-y-2">
                  <Label>Registration Closes</Label>
                  <Input type="datetime-local" {...register("registrationEndDate")} />
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Venue</h3>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Online Event</p><p className="text-xs text-muted-foreground">This is a virtual event</p></div>
                <Switch checked={watch("isOnline")} onCheckedChange={(v) => setValue("isOnline", !!v)} />
              </div>
              {!isOnline && (
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Venue Name</Label><Input placeholder="e.g., Auditorium Hall" {...register("venue")} /></div>
                  <div className="space-y-2"><Label>Address</Label><Textarea placeholder="Full address..." rows={2} {...register("venueAddress")} /></div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2"><Label>City</Label><Input placeholder="City" {...register("venueCity")} /></div>
                    <div className="space-y-2"><Label>State</Label><Input placeholder="State" {...register("venueState")} /></div>
                    <div className="space-y-2"><Label>Country</Label><Input placeholder="India" {...register("venueCountry")} /></div>
                  </div>
                </div>
              )}
              {isOnline && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={watch("onlinePlatform") || ""} onValueChange={(v) => setValue("onlinePlatform", v || "")}>
                      <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ZOOM">Zoom</SelectItem>
                        <SelectItem value="GOOGLE_MEET">Google Meet</SelectItem>
                        <SelectItem value="TEAMS">Microsoft Teams</SelectItem>
                        <SelectItem value="YOUTUBE">YouTube Live</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Meeting Link</Label><Input placeholder="https://..." {...register("onlineLink")} /></div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* STEP 3: Tickets */}
        {step === 3 && (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Pricing</h3>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Paid Event</p><p className="text-xs text-muted-foreground">Charge for tickets</p></div>
                <Switch checked={watch("isPaid")} onCheckedChange={(v) => setValue("isPaid", !!v)} />
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Ticket Types</h3>
                <Button type="button" variant="outline" size="sm" onClick={addTicketType} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Ticket
                </Button>
              </div>
              {ticketTypes.map((tt, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Ticket {i + 1}</span>
                    {ticketTypes.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTicketType(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">Name</Label><Input placeholder="General Admission" value={tt.name} onChange={(e) => updateTicketType(i, "name", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Price (&#8377;)</Label><Input type="number" min={0} value={tt.price} onChange={(e) => updateTicketType(i, "price", parseFloat(e.target.value) || 0)} disabled={!isPaid} /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">Quantity (blank = unlimited)</Label><Input type="number" min={1} value={typeof tt.quantity === "number" ? tt.quantity : ""} onChange={(e) => updateTicketType(i, "quantity", e.target.value ? parseInt(e.target.value) : undefined)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Max Per User</Label><Input type="number" min={1} max={10} value={tt.maxPerUser} onChange={(e) => updateTicketType(i, "maxPerUser", parseInt(e.target.value) || 1)} /></div>
                  </div>
                </div>
              ))}
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Registration Settings</h3>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Max Capacity (optional)</Label><Input type="number" min={1} placeholder="Leave blank for unlimited" {...register("maxCapacity")} /></div>
                <div className="flex items-center justify-between"><div><p className="text-sm">Enable Waitlist</p><p className="text-xs text-muted-foreground">Allow waitlist when full</p></div><Switch checked={watch("waitlistEnabled")} onCheckedChange={(v) => setValue("waitlistEnabled", !!v)} /></div>
                <div className="flex items-center justify-between"><div><p className="text-sm">Require Approval</p><p className="text-xs text-muted-foreground">Manually approve each registration</p></div><Switch checked={watch("approvalRequired")} onCheckedChange={(v) => setValue("approvalRequired", !!v)} /></div>
                <div className="flex items-center justify-between"><div><p className="text-sm">Team Registration</p><p className="text-xs text-muted-foreground">Allow teams to register</p></div><Switch checked={watch("allowTeamRegistration")} onCheckedChange={(v) => setValue("allowTeamRegistration", !!v)} /></div>
                {watch("allowTeamRegistration") && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-4">
                    <div className="space-y-1"><Label className="text-xs">Min Team Size</Label><Input type="number" min={2} {...register("minTeamSize")} /></div>
                    <div className="space-y-1"><Label className="text-xs">Max Team Size</Label><Input type="number" min={2} {...register("maxTeamSize")} /></div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* STEP 4: Registration Form */}
        {step === 4 && (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Default Fields</h3>
              <p className="text-xs text-muted-foreground">Name and Email are always collected.</p>
              <div className="space-y-2">
                {["Name (always required)", "Email (always required)", "Phone", "College/University", "Company"].map((field) => (
                  <div key={field} className="flex items-center justify-between py-1">
                    <span className="text-sm">{field}</span>
                    {field.includes("always") ? <Badge variant="secondary">Required</Badge> : <Switch />}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Custom Fields</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {FIELD_TYPES.map((ft) => (
                  <Button key={ft.value} type="button" variant="outline" size="sm" onClick={() => addCustomField(ft.value)} className="gap-1">
                    <Plus className="h-3 w-3" /> {ft.label}
                  </Button>
                ))}
              </div>
              {customFields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No custom fields. Click a field type above to add one.</p>
              )}
              {customFields.map((field, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{FIELD_TYPES.find((f) => f.value === field.fieldType)?.label || field.fieldType}</Badge>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCustomField(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">Label *</Label><Input placeholder="Field label" value={field.label} onChange={(e) => updateCustomField(i, "label", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Placeholder</Label><Input placeholder="Placeholder text" value={field.placeholder || ""} onChange={(e) => updateCustomField(i, "placeholder", e.target.value)} /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Help Text</Label><Input placeholder="Additional info" value={field.helpText || ""} onChange={(e) => updateCustomField(i, "helpText", e.target.value)} /></div>
                  <div className="flex items-center gap-2"><Switch checked={field.isRequired} onCheckedChange={(v) => updateCustomField(i, "isRequired", !!v)} /><Label className="text-xs">Required</Label></div>
                  {["SELECT", "MULTI_SELECT", "RADIO"].includes(field.fieldType) && (
                    <div className="space-y-1">
                      <Label className="text-xs">Options (one per line)</Label>
                      <Textarea rows={3} value={(field.options || []).join("\n")} onChange={(e) => updateCustomField(i, "options", e.target.value.split("\n").filter(Boolean))} placeholder={"Option 1\nOption 2\nOption 3"} />
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* STEP 5: Media & Details */}
        {step === 5 && (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Cover Image</h3>
              <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed hover:border-primary transition-colors cursor-pointer">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground mt-2">Drag & drop or click to upload</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP (max 5MB, 16:9 recommended)</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Additional Details</h3>
              <div className="space-y-2"><Label>Rules & Guidelines</Label><Textarea rows={3} placeholder="Event rules, dress code..." {...register("rules")} /></div>
              <div className="space-y-2"><Label>Terms & Conditions</Label><Textarea rows={3} placeholder="Terms participants must agree to..." {...register("termsAndConditions")} /></div>
              <div className="space-y-2"><Label>Refund Policy</Label><Textarea rows={2} placeholder="Refund policy..." {...register("refundPolicy")} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Contact Email</Label><Input type="email" {...register("contactEmail")} /></div>
                <div className="space-y-2"><Label>Contact Phone</Label><Input {...register("contactPhone")} /></div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">FAQs</h3>
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex justify-between"><Label className="text-xs">Question</Label><Button type="button" variant="ghost" size="icon-sm" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>
                  <Input value={faq.question} onChange={(e) => { const u = [...faqs]; u[i] = { ...u[i], question: e.target.value }; setFaqs(u) }} />
                  <Label className="text-xs">Answer</Label>
                  <Textarea rows={2} value={faq.answer} onChange={(e) => { const u = [...faqs]; u[i] = { ...u[i], answer: e.target.value }; setFaqs(u) }} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setFaqs([...faqs, { question: "", answer: "" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add FAQ</Button>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Sponsors</h3>
              {sponsors.map((sp, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Sponsor {i + 1}</Label>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSponsors(sponsors.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input placeholder="Sponsor name" value={sp.name} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], name: e.target.value }; setSponsors(u) }} />
                    <Input placeholder="Tier (Title, Gold, Silver)" value={sp.tier} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], tier: e.target.value }; setSponsors(u) }} />
                    <Input placeholder="Website URL" value={sp.website} onChange={(e) => { const u = [...sponsors]; u[i] = { ...u[i], website: e.target.value }; setSponsors(u) }} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setSponsors([...sponsors, { name: "", tier: "GOLD", website: "" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Sponsor</Button>
            </Card>
          </div>
        )}

        {/* STEP 6: Review & Publish */}
        {step === 6 && (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-sm font-medium mb-3">Event Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="font-medium">{watch("title") || "—"}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><Badge variant="secondary">{watch("type")}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><Badge variant="secondary">{watch("category") || "—"}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Visibility</span><Badge variant="outline">{watch("visibility")}</Badge></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{watch("startDate") || "Not set"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{watch("endDate") || "Not set"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span>{isOnline ? watch("onlinePlatform") || "Online" : watch("venue") || "—"}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Ticket Types</span><span>{ticketTypes.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pricing</span><span>{isPaid ? "Paid" : "Free"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Custom Fields</span><span>{customFields.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FAQs</span><span>{faqs.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sponsors</span><span>{sponsors.length}</span></div>
              </div>
            </Card>

            {/* Validation warnings */}
            {!watch("title") && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Event title is required</div>}
            {!watch("startDate") && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Start date is required</div>}
            {ticketTypes.some((t) => !t.name) && <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">Some ticket types are missing names</div>}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="sticky bottom-0 border-t bg-background p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Button type="button" variant="outline" onClick={saveAsDraft} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save as Draft
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={goBack} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {step < 6 ? (
              <Button type="button" onClick={goNext} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={publishEvent} disabled={isPublishing} className="gap-2">
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Publish Event
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
