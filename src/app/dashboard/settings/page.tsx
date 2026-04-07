"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Save, Loader2, Key, Lock } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

const notificationCategories = [
  { label: "Registration Confirmations", key: "reg_confirm", email: true, inApp: true, required: true },
  { label: "Registration Updates", key: "reg_update", email: true, inApp: true },
  { label: "Payment Receipts", key: "payment", email: true, inApp: true, required: true },
  { label: "Event Reminders (24h)", key: "reminder_24h", email: true, inApp: true },
  { label: "Event Reminders (1h)", key: "reminder_1h", email: true, inApp: true },
  { label: "Event Updates & Changes", key: "event_update", email: true, inApp: true },
  { label: "Event Cancellations", key: "event_cancel", email: true, inApp: true, required: true },
  { label: "Announcements", key: "announcement", email: true, inApp: true },
  { label: "Certificates Available", key: "certificate", email: true, inApp: true },
  { label: "Feedback Requests", key: "feedback", email: false, inApp: true },
  { label: "Marketing / Newsletters", key: "marketing", email: false, inApp: false },
  { label: "Platform Updates", key: "platform", email: false, inApp: true },
]

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false)
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; inApp: boolean }>>({})
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwords, setPasswords] = useState({ current: "", newPassword: "", confirm: "" })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Initialize preferences
  useEffect(() => {
    const initial: Record<string, { email: boolean; inApp: boolean }> = {}
    notificationCategories.forEach((cat) => { initial[cat.key] = { email: cat.email, inApp: cat.inApp } })
    setPrefs(initial)
  }, [])

  const togglePref = (key: string, type: "email" | "inApp") => {
    setPrefs((prev) => ({ ...prev, [key]: { ...prev[key], [type]: !prev[key]?.[type] } }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPreferences: prefs }),
      })
      const json = await res.json()
      if (json.success) toast.success("Preferences saved")
      else toast.error(json.message || "Failed to save")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!passwords.current || !passwords.newPassword) {
      toast.error("Please fill in all password fields")
      return
    }
    if (passwords.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    if (passwords.newPassword !== passwords.confirm) {
      toast.error("New passwords don't match")
      return
    }
    setIsChangingPassword(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPassword }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Password changed successfully")
        setPasswords({ current: "", newPassword: "", confirm: "" })
        setShowPasswordChange(false)
      } else {
        toast.error(json.message || "Failed to change password")
      }
    } catch {
      toast.error("Failed to change password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Settings"
        actions={
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Preferences
          </Button>
        }
      />

      {/* Password Change */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Password & Security</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Change your password</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPasswordChange(!showPasswordChange)}>
            <Key className="h-4 w-4" /> {showPasswordChange ? "Cancel" : "Change Password"}
          </Button>
        </div>
        {showPasswordChange && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
            </div>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword} className="gap-2">
              {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Update Password
            </Button>
          </div>
        )}
      </Card>

      {/* Notification Preferences */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Notification Preferences</h3>
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr,60px,60px] items-center gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
            <span>Category</span>
            <span className="text-center">Email</span>
            <span className="text-center">In-App</span>
          </div>

          {notificationCategories.map((cat) => (
            <div key={cat.key} className="grid grid-cols-[1fr,60px,60px] items-center gap-2 py-2.5 border-b last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{cat.label}</span>
                {cat.required && <Badge variant="outline" className="text-[9px] px-1">Required</Badge>}
              </div>
              <div className="flex justify-center">
                <Switch checked={prefs[cat.key]?.email ?? cat.email} onCheckedChange={() => togglePref(cat.key, "email")} disabled={cat.required} />
              </div>
              <div className="flex justify-center">
                <Switch checked={prefs[cat.key]?.inApp ?? cat.inApp} onCheckedChange={() => togglePref(cat.key, "inApp")} disabled={cat.required} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
