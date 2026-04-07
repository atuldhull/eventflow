"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function ProfilePage() {
  const { data: session } = useSession()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

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
            <Input defaultValue={session?.user?.name || ""} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={session?.user?.email || ""} disabled className="bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="+91 9876543210" />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input placeholder="Your city" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea placeholder="Tell us about yourself..." rows={3} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Education / Work</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>College / University</Label>
            <Input placeholder="e.g., IIT Delhi" />
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Input placeholder="e.g., Google" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Designation</Label>
          <Input placeholder="e.g., Software Engineer" />
        </div>
      </Card>
    </div>
  )
}
