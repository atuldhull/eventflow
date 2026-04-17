"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Check, ChevronLeft, ChevronRight, Save, Loader2, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/utils"
import type { TicketTypeInput, CustomFormFieldInput } from "@/lib/validations/event"

import { wizardSchema, STEPS, type WizardFormData } from "./wizard/shared"
import { Step1Basic } from "./wizard/Step1Basic"
import { Step2DateVenue } from "./wizard/Step2DateVenue"
import { Step3Tickets } from "./wizard/Step3Tickets"
import { Step4Form } from "./wizard/Step4Form"
import { Step5Media } from "./wizard/Step5Media"
import { Step6Review } from "./wizard/Step6Review"

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
  const [addons, setAddons] = useState<{ name: string; price: number; category: string; maxQuantity: number }[]>([])

  const {
    register,
    watch,
    setValue,
    trigger,
    getValues,
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

  useEffect(() => {
    if (mode === "create" && title) {
      setValue("slug", slugify(title))
    }
  }, [title, mode, setValue])

  const validateStep = async (stepNum: number): Promise<boolean> => {
    const fieldsPerStep: Record<number, (keyof WizardFormData)[]> = {
      1: ["title", "slug", "shortDescription", "description", "type", "category", "visibility"],
      2: ["startDate", "endDate", "timezone"],
      3: [], 4: [], 5: [], 6: [],
    }
    const fields = fieldsPerStep[stepNum] || []
    if (fields.length === 0) return true
    return trigger(fields)
  }

  const goNext = async () => {
    const valid = await validateStep(step)
    if (valid && step < 6) setStep(step + 1)
  }

  const goBack = () => { if (step > 1) setStep(step - 1) }

  const buildPayload = (status: "DRAFT" | "PUBLISHED") => {
    const values = getValues()
    return {
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
      settings: {
        ...(values.allowedEmailDomains ? { allowedEmailDomains: values.allowedEmailDomains } : {}),
        ...(values.recurrencePattern ? { recurrencePattern: values.recurrencePattern, recurrenceCount: parseInt(values.recurrenceCount || "1") } : {}),
        ...(values.budgetAmount ? { budgetAmount: parseFloat(values.budgetAmount), budgetNotes: values.budgetNotes || "" } : {}),
        ...(values.maxGuestsPerRegistration ? { maxGuestsPerRegistration: parseInt(values.maxGuestsPerRegistration) } : {}),
        ...(addons.length > 0 ? { addons } : {}),
        ...(values.enableDynamicPricing ? { enableDynamicPricing: true, dynamicPricingTiers: values.dynamicPricingTiers } : {}),
      },
      status,
    }
  }

  const submitEvent = async (status: "DRAFT" | "PUBLISHED") => {
    const url = mode === "edit" && initialData?.id
      ? `/api/admin/org/${orgId}/events/${initialData.id}`
      : `/api/admin/org/${orgId}/events`
    const method = mode === "edit" && initialData?.id ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(status)),
    })
    return res.json()
  }

  const saveAsDraft = async () => {
    setIsSaving(true)
    try {
      const result = await submitEvent("DRAFT")
      if (!result.success) { toast.error(result.message || "Failed to save"); return }
      toast.success("Draft saved successfully")
      if (mode === "create") router.push("/admin/org/events")
    } catch { toast.error("Failed to save draft") } finally { setIsSaving(false) }
  }

  const publishEvent = async () => {
    const allValid = await trigger()
    if (!allValid) { toast.error("Please fill in all required fields"); return }

    setIsPublishing(true)
    try {
      const result = await submitEvent("PUBLISHED")
      if (!result.success) { toast.error(result.message || "Failed to publish"); return }
      toast.success("Event published successfully!")
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
        {step === 1 && <Step1Basic {...stepProps} />}
        {step === 2 && <Step2DateVenue {...stepProps} />}
        {step === 3 && <Step3Tickets {...stepProps} ticketTypes={ticketTypes} addTicketType={addTicketType} removeTicketType={removeTicketType} updateTicketType={updateTicketType} addons={addons} setAddons={setAddons} />}
        {step === 4 && <Step4Form {...stepProps} customFields={customFields} addCustomField={addCustomField} removeCustomField={removeCustomField} updateCustomField={updateCustomField} />}
        {step === 5 && <Step5Media {...stepProps} faqs={faqs} setFaqs={setFaqs} sponsors={sponsors} setSponsors={setSponsors} />}
        {step === 6 && <Step6Review watch={watch} ticketTypes={ticketTypes} customFields={customFields} faqs={faqs} sponsors={sponsors} addons={addons} />}
      </div>

      {/* Bottom Navigation */}
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
