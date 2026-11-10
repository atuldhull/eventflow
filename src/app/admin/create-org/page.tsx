"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2 } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useRBAC } from "@/hooks/useRBAC"

const CATEGORIES = ["TECHNICAL", "CULTURAL", "SPORTS", "ACADEMIC", "SOCIAL", "PROFESSIONAL", "CORPORATE", "HR", "ENGINEERING", "MARKETING", "OTHER"]
const categoryLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase()

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-6 first:border-t-0 first:pt-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  )
}

export default function CreateOrgPage() {
  const router = useRouter()
  const { setOrganizationContext } = useRBAC()
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", category: "", description: "", email: "", phone: "", website: "" })
  // Settings → Public event creation: null until known; POST enforces it either way
  const [closedMessage, setClosedMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/organizations")
      .then((r) => r.json())
      .then((json) => { if (!cancelled && json?.success && !json.data?.allowed) setClosedMessage(json.data?.message ?? "Creating organizations is turned off.") })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleSlugify = (name: string) => {
    setForm({ ...form, name, slug: name.toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-") })
  }

  const handleCreate = async () => {
    if (!form.name || !form.email) { toast.error("Name and email are required"); return }
    setIsCreating(true)
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Organization created!")
        setOrganizationContext(json.data.id)
        router.push("/admin/org")
      } else {
        toast.error(json.message || "Failed to create")
      }
    } catch { toast.error("Failed to create organization") }
    finally { setIsCreating(false) }
  }

  if (closedMessage) {
    return (
      <div className="max-w-4xl space-y-6">
        <PageHeader title="Create organization" />
        <EmptyState variant="page" icon={Building2} title="Organizations are by invitation only" description={closedMessage}>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Back to my dashboard</Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Create organization" description="Set up your organization to start hosting events" />

      <form
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void handleCreate()
        }}
      >
        <Section title="Basics" description="How your organization appears on its public page.">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization name<span className="text-faint" aria-hidden> *</span></Label>
            <Input id="org-name" value={form.name} onChange={(e) => handleSlugify(e.target.value)} placeholder="e.g., CodeCraft — IIT Bombay Coding Club" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-slug">URL slug</Label>
            <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="flex shrink-0 items-center border-r border-input bg-raised px-3 text-[13px] text-muted-foreground select-none max-sm:max-w-[45%] max-sm:truncate">
                eventflow.com/org/
              </span>
              <Input
                id="org-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="codecraft-iit-bombay"
                className="rounded-none border-0 focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-category">Category</Label>
            <Select
              items={CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v || "" })}
            >
              <SelectTrigger id="org-category" className="w-full sm:w-64"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-description">Description</Label>
            <Textarea id="org-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Briefly describe your organization..." rows={3} />
          </div>
        </Section>

        <Section title="Contact" description="How people can reach your organization.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-email">Email<span className="text-faint" aria-hidden> *</span></Label>
              <Input id="org-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="club@college.edu" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-phone">Phone</Label>
              <Input id="org-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-website">Website</Label>
            <Input id="org-website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourclub.com" />
          </div>
        </Section>

        <div className="flex justify-end border-t border-rule pt-6">
          <Button type="submit" disabled={isCreating} className="max-sm:w-full">
            {isCreating && <Loader2 className="animate-spin" />}
            Create organization
          </Button>
        </div>
      </form>
    </div>
  )
}
