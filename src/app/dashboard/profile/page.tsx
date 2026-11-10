"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

interface ProfileData {
  name: string; email: string; phone: string; city: string; bio: string
  collegeName: string; companyName: string; designation: string
}

/** A settings-style section: heading on the left, fields on the right (stacked on phones). */
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

export default function ProfilePage() {
  // update() re-issues the session, so the header shows a new name right after saving
  const { update: updateSession } = useSession()
  const [profile, setProfile] = useState<ProfileData>({ name: "", email: "", phone: "", city: "", bio: "", collegeName: "", companyName: "", designation: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/users/me/profile")
        const json = await res.json()
        if (json.success && json.data) {
          setProfile({
            name: json.data.name || "",
            email: json.data.email || "",
            phone: json.data.phone || "",
            city: json.data.city || "",
            bio: json.data.bio || "",
            collegeName: json.data.collegeName || "",
            companyName: json.data.companyName || "",
            designation: json.data.designation || "",
          })
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchProfile()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { email, ...updateData } = profile
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Profile updated")
        await updateSession({ name: updateData.name }).catch(() => undefined)
      } else toast.error(json.message || "Failed to save")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const update = (field: keyof ProfileData, value: string) => setProfile({ ...profile, [field]: value })

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your account details"
        actions={
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading profile">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Personal information" description="Your name and how to reach you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="p-name">Full name</Label>
                <Input id="p-name" autoComplete="name" value={profile.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" value={profile.email} disabled aria-describedby="p-email-hint" />
                <p id="p-email-hint" className="text-xs text-muted-foreground">Your sign-in email can&apos;t be changed here.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="p-phone">Phone</Label>
                <Input id="p-phone" type="tel" autoComplete="tel" placeholder="+91 9876543210" value={profile.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-city">City</Label>
                <Input id="p-city" autoComplete="address-level2" placeholder="Your city" value={profile.city} onChange={(e) => update("city", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-bio">Bio</Label>
              <Textarea id="p-bio" placeholder="Tell us about yourself..." rows={3} value={profile.bio} onChange={(e) => update("bio", e.target.value)} />
            </div>
          </Section>

          <Section title="Education and work" description="Where you study or work.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="p-college">College / University</Label>
                <Input id="p-college" placeholder="e.g., IIT Delhi" value={profile.collegeName} onChange={(e) => update("collegeName", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-company">Company</Label>
                <Input id="p-company" autoComplete="organization" placeholder="e.g., Google" value={profile.companyName} onChange={(e) => update("companyName", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-designation">Designation</Label>
              <Input id="p-designation" autoComplete="organization-title" placeholder="e.g., Software Engineer" value={profile.designation} onChange={(e) => update("designation", e.target.value)} />
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
