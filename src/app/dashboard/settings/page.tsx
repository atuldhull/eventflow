"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      toast.success("Preferences saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
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
                <Switch defaultChecked={cat.email} disabled={cat.required} />
              </div>
              <div className="flex justify-center">
                <Switch defaultChecked={cat.inApp} disabled={cat.required} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
