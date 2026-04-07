"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
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
import { slugify } from "@/lib/utils"

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

  const name = watch("name", "")

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

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Create Organization"
        description="Add a new organization to your enterprise"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Organizations", href: "/admin/enterprise/organizations" },
          { label: "Create" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-medium">Basic Information</h3>

          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input id="name" placeholder="e.g. Tech Club" {...register("name")} onChange={handleNameChange} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" placeholder="tech-club" {...register("slug")} />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={watch("category")} onValueChange={(v) => setValue("category", v || "")}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Brief description..." rows={3} {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="org@example.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" placeholder="+91 9876543210" {...register("phone")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input id="website" placeholder="https://..." {...register("website")} />
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Organization
          </Button>
        </div>
      </form>
    </div>
  )
}
