"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { useRBAC } from "@/hooks/useRBAC"
import { statusLabel } from "@/lib/status-tone"
import { slugify } from "@/lib/utils"
import { Section } from "../../_components/admin-ui"

const createOrgSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  category: z.string().min(1, "Category is required"),
  description: z.string().max(1000).optional().or(z.literal("")),
  email: z.email("Invalid email"),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
})

type CreateOrgInput = z.infer<typeof createOrgSchema>

const categories = ["TECHNICAL", "CULTURAL", "SPORTS", "SOCIAL", "ACADEMIC", "PROFESSIONAL", "CORPORATE", "HR", "ENGINEERING", "MARKETING", "OTHER"]
const categoryItems = categories.map((value) => ({ value, label: statusLabel(value) }))

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} role="alert" className="text-xs text-destructive">{message}</p>
}

export default function CreateOrganizationPage() {
  const router = useRouter()
  const { currentEnterpriseId } = useRBAC()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { slug: "", category: "" },
  })

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValue("name", value)
    setValue("slug", slugify(value))
  }

  const onSubmit = async (data: CreateOrgInput) => {
    if (!currentEnterpriseId) {
      toast.error("No enterprise selected")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (!result.success) {
        toast.error(result.message || "Failed to create organization")
        return
      }

      toast.success("Organization created successfully!")
      router.push("/admin/enterprise/organizations")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  const err = (field: keyof CreateOrgInput) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `${field}-error` } : {}

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="New organization"
        description="Add a club, department or team to your enterprise."
        breadcrumbs={[
          { label: "Organizations", href: "/admin/enterprise/organizations" },
          { label: "New" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Section title="Basics" description="The name people see and the address of its page.">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" placeholder="e.g. Tech Club" {...register("name")} onChange={handleNameChange} {...err("name")} />
              <FieldError id="name-error" message={errors.name?.message} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" placeholder="tech-club" className="font-mono" {...register("slug")} {...err("slug")} />
              <FieldError id="slug-error" message={errors.slug?.message} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select items={categoryItems} value={watch("category")} onValueChange={(v) => setValue("category", v || "")}>
                <SelectTrigger id="category" className="w-full data-[size=default]:h-9" {...err("category")}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{statusLabel(cat)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="category-error" message={errors.category?.message} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Brief description…" rows={3} {...register("description")} {...err("description")} />
              <FieldError id="description-error" message={errors.description?.message} />
            </div>
          </div>
        </Section>

        <Section title="Contact" description="How members and attendees reach the organization.">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="org@example.com" {...register("email")} {...err("email")} />
                <FieldError id="email-error" message={errors.email?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="phone" type="tel" placeholder="+91 9876543210" {...register("phone")} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="website">Website <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="website" placeholder="https://…" {...register("website")} {...err("website")} />
              <FieldError id="website-error" message={errors.website?.message} />
            </div>
          </div>
        </Section>

        <div className="flex flex-col-reverse gap-2 border-t border-rule pt-6 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Create organization
          </Button>
        </div>
      </form>
    </div>
  )
}
