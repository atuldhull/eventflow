"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/super-admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updated: true }) })
      const json = await res.json()
      if (json.success) toast.success(json.message || "Settings saved")
      else toast.error(json.message || "Failed to save")
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Configure global platform settings"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Settings" },
        ]}
        actions={
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        }
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card className="p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform Name</Label>
                <Input defaultValue="EventFlow" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input defaultValue="support@eventflow.com" type="email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Platform Description</Label>
              <Textarea defaultValue="Professional event management platform for universities, colleges, and enterprises." rows={3} />
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <Input type="color" defaultValue="#09090b" className="h-10 w-20" />
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <Input type="color" defaultValue="#ffffff" className="h-10 w-20" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <Card className="p-6 space-y-4">
            {[
              { label: "User Registration", description: "Allow new users to sign up", defaultChecked: true },
              { label: "Google OAuth", description: "Allow login with Google", defaultChecked: true },
              { label: "Microsoft OAuth", description: "Allow login with Microsoft", defaultChecked: true },
              { label: "Email Verification Required", description: "Require email verification for new accounts", defaultChecked: true },
              { label: "Public Event Creation", description: "Allow any user to create events", defaultChecked: false },
              { label: "Enterprise Self-Registration", description: "Allow enterprises to register themselves", defaultChecked: false },
              { label: "Payment Processing", description: "Enable paid events and ticketing", defaultChecked: true },
              { label: "Certificate Generation", description: "Enable certificate generation for events", defaultChecked: true },
              { label: "SMS Notifications", description: "Enable SMS notifications", defaultChecked: false },
            ].map((feature) => (
              <div key={feature.label} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
                <Switch defaultChecked={feature.defaultChecked} />
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <Card className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>From Name</Label>
                <Input defaultValue="EventFlow" />
              </div>
              <div className="space-y-2">
                <Label>From Email</Label>
                <Input defaultValue="noreply@eventflow.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Reply-To Email</Label>
                <Input defaultValue="support@eventflow.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input placeholder="smtp.example.com" />
              </div>
            </div>
            <Button variant="outline">Send Test Email</Button>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Max Login Attempts</Label>
                <Input type="number" defaultValue="5" />
              </div>
              <div className="space-y-2">
                <Label>Lockout Duration (minutes)</Label>
                <Input type="number" defaultValue="15" />
              </div>
              <div className="space-y-2">
                <Label>Session Timeout (hours)</Label>
                <Input type="number" defaultValue="24" />
              </div>
              <div className="space-y-2">
                <Label>Min Password Length</Label>
                <Input type="number" defaultValue="8" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Require 2FA for Admins</p>
                <p className="text-xs text-muted-foreground">Force two-factor authentication for all admin roles</p>
              </div>
              <Switch />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-destructive">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Enable maintenance mode to prevent user access</p>
              </div>
              <Switch />
            </div>
            <div className="space-y-2">
              <Label>Maintenance Message</Label>
              <Textarea placeholder="We're performing scheduled maintenance. We'll be back shortly!" rows={3} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
