"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface ProfileData {
  name: string; email: string; phone: string; city: string; bio: string
  collegeName: string; companyName: string; designation: string
}

export default function ProfilePage() {
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
      if (json.success) toast.success("Profile updated")
      else toast.error(json.message || "Failed to save")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const update = (field: keyof ProfileData, value: string) => setProfile({ ...profile, [field]: value })

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Profile"
        description="Manage your account details"
        actions={
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        }
      />

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Personal Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={profile.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="+91 9876543210" value={profile.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input placeholder="Your city" value={profile.city} onChange={(e) => update("city", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea placeholder="Tell us about yourself..." rows={3} value={profile.bio} onChange={(e) => update("bio", e.target.value)} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Education / Work</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>College / University</Label>
            <Input placeholder="e.g., IIT Delhi" value={profile.collegeName} onChange={(e) => update("collegeName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Input placeholder="e.g., Google" value={profile.companyName} onChange={(e) => update("companyName", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Designation</Label>
          <Input placeholder="e.g., Software Engineer" value={profile.designation} onChange={(e) => update("designation", e.target.value)} />
        </div>
      </Card>
    </div>
  )
}
