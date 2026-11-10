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
import { SettingsSection } from "../_components/bits"

interface ProfileData {
  name: string; email: string; phone: string; city: string; bio: string
  collegeName: string; companyName: string; designation: string
}

/** A settings-style section: heading on the left, fields in a panel on the right (stacked on phones). */
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <SettingsSection title={title} description={description}>
      <div className="grid gap-4">{children}</div>
    </SettingsSection>
  )
}

const initialsOf = (name: string, email: string) =>
  (name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") : email.slice(0, 1)).toUpperCase()

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
    <div className="max-w-4xl space-y-6">
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
          {/* who this is, at a glance; follows the name field as it's edited */}
          <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
            <span
              aria-hidden
              className="font-display flex size-16 shrink-0 items-center justify-center rounded-full bg-lavender text-[24px] font-extrabold tracking-[-0.03em] text-charcoal"
            >
              {initialsOf(profile.name, profile.email)}
            </span>
            <div className="min-w-0">
              <p className="font-display truncate text-[22px] leading-7 font-bold tracking-[-0.03em]">{profile.name || "Your name"}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
              {(profile.collegeName || profile.companyName || profile.city) && (
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {[profile.designation && profile.companyName ? `${profile.designation}, ${profile.companyName}` : profile.companyName || profile.collegeName, profile.city]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          <Section title="Personal information" description="Your name and how to reach you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <Label htmlFor="p-name">Full name</Label>
                <Input id="p-name" autoComplete="name" value={profile.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div className="grid content-start gap-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" value={profile.email} disabled aria-describedby="p-email-hint" />
                <p id="p-email-hint" className="text-xs text-muted-foreground">Your sign-in email can&apos;t be changed here.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <Label htmlFor="p-phone">Phone</Label>
                <Input id="p-phone" type="tel" autoComplete="tel" placeholder="+91 9876543210" value={profile.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="grid content-start gap-1.5">
                <Label htmlFor="p-city">City</Label>
                <Input id="p-city" autoComplete="address-level2" placeholder="Your city" value={profile.city} onChange={(e) => update("city", e.target.value)} />
              </div>
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="p-bio">Bio</Label>
              <Textarea id="p-bio" placeholder="Tell us about yourself..." rows={3} value={profile.bio} onChange={(e) => update("bio", e.target.value)} />
            </div>
          </Section>

          <Section title="Education and work" description="Where you study or work.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <Label htmlFor="p-college">College / University</Label>
                <Input id="p-college" placeholder="e.g., IIT Delhi" value={profile.collegeName} onChange={(e) => update("collegeName", e.target.value)} />
              </div>
              <div className="grid content-start gap-1.5">
                <Label htmlFor="p-company">Company</Label>
                <Input id="p-company" autoComplete="organization" placeholder="e.g., Google" value={profile.companyName} onChange={(e) => update("companyName", e.target.value)} />
              </div>
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="p-designation">Designation</Label>
              <Input id="p-designation" autoComplete="organization-title" placeholder="e.g., Software Engineer" value={profile.designation} onChange={(e) => update("designation", e.target.value)} />
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
