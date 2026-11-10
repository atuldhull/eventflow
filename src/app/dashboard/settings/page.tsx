"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { signIn, signOut, useSession } from "next-auth/react"
import { Loader2, Key, Download, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Pill } from "@/components/ui/pill"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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

type Prefs = Record<string, { email: boolean; inApp: boolean }>

/** Saved choices over the defaults; required categories are always on, whatever was saved. */
function mergePrefs(saved: unknown): Prefs {
  const stored = (saved && typeof saved === "object" ? saved : {}) as Partial<Prefs>
  const prefs: Prefs = {}
  for (const cat of notificationCategories) {
    const s = stored[cat.key]
    prefs[cat.key] = cat.required
      ? { email: true, inApp: true }
      : {
          email: typeof s?.email === "boolean" ? s.email : cat.email,
          inApp: typeof s?.inApp === "boolean" ? s.inApp : cat.inApp,
        }
  }
  return prefs
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [isSaving, setIsSaving] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(() => mergePrefs(null))
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwords, setPasswords] = useState({ current: "", newPassword: "", confirm: "" })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [account, setAccount] = useState<{ email: string; hasPassword: boolean } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Load the saved preferences over the defaults
  useEffect(() => {
    let cancelled = false
    async function fetchPrefs() {
      try {
        const res = await fetch("/api/users/me/profile")
        const json = await res.json()
        if (!cancelled && json.success) setPrefs(mergePrefs(json.data?.notificationPreferences))
      } catch {} finally {
        if (!cancelled) setPrefsLoaded(true)
      }
    }
    fetchPrefs()
    return () => { cancelled = true }
  }, [])

  // Which confirmation "Delete my account" asks for: the password, or DELETE for social sign-in
  useEffect(() => {
    let cancelled = false
    fetch("/api/users/me")
      .then((res) => res.json())
      .then((json) => { if (!cancelled && json.success) setAccount(json.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetch("/api/users/me/export")
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.message || "Couldn't prepare your data")
        return
      }
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "eventflow-data.json"
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success("Your data is downloading")
    } catch {
      toast.error("Couldn't prepare your data")
    } finally {
      setIsExporting(false)
    }
  }

  const closeDelete = () => {
    if (isDeleting) return
    setDeleteOpen(false)
    setDeleteConfirm("")
  }

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deleteConfirm.trim()) return
    setIsDeleting(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account?.hasPassword === false ? { confirmation: deleteConfirm } : { password: deleteConfirm }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.message || "Couldn't delete your account")
        setIsDeleting(false)
        return
      }
      toast.success("Your account has been deleted")
      await signOut({ callbackUrl: "/" })
    } catch {
      toast.error("Couldn't delete your account")
      setIsDeleting(false)
    }
  }

  const togglePref = (key: string, type: "email" | "inApp") => {
    setPrefs((prev) => ({ ...prev, [key]: { ...prev[key], [type]: !prev[key]?.[type] } }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPreferences: mergePrefs(prefs) }),
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

  const handlePasswordChange = async (e?: React.FormEvent) => {
    e?.preventDefault()
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
        // The change ends every session that signed in earlier, this one included. Signing
        // this device back in with the new password leaves only the other devices signed out.
        const email = session?.user?.email
        const renewed = email
          ? await signIn("credentials", { email, password: passwords.newPassword, redirect: false })
          : undefined
        if (!renewed || renewed.error) {
          toast.success("Password changed. Please log in with your new password.")
          await signOut({ callbackUrl: "/login" })
          return
        }
        toast.success("Password changed. Other devices will be signed out within a few minutes.")
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
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        actions={
          <Button onClick={handleSave} disabled={isSaving || !prefsLoaded}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save preferences
          </Button>
        }
      />

      <div className="space-y-8">
        <Section title="Password and security" description="Change the password you sign in with.">
          {!showPasswordChange ? (
            <Button variant="outline" onClick={() => setShowPasswordChange(true)}>
              <Key /> Change password
            </Button>
          ) : (
            <form onSubmit={handlePasswordChange} className="grid max-w-sm gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="pw-current">Current password</Label>
                <Input id="pw-current" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw-new">New password</Label>
                <Input id="pw-new" type="password" autoComplete="new-password" aria-describedby="pw-new-hint" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
                <p id="pw-new-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw-confirm">Confirm new password</Label>
                <Input id="pw-confirm" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword && <Loader2 className="animate-spin" />}
                  Update password
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowPasswordChange(false)} disabled={isChangingPassword}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Section>

        <Section title="Notifications" description="Choose how we reach you. Required messages can't be turned off.">
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-rule bg-raised px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Category</span>
              <span className="text-center">Email</span>
              <span className="text-center">In-app</span>
            </div>
            <ul className="divide-y divide-rule">
              {notificationCategories.map((cat) => (
                <li key={cat.key} className="grid min-h-12 grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 px-4 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm">{cat.label}</span>
                    {cat.required && <Pill>Required</Pill>}
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      aria-label={`${cat.label} by email`}
                      checked={prefs[cat.key]?.email ?? cat.email}
                      onCheckedChange={() => togglePref(cat.key, "email")}
                      disabled={cat.required}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      aria-label={`${cat.label} in the app`}
                      checked={prefs[cat.key]?.inApp ?? cat.inApp}
                      onCheckedChange={() => togglePref(cat.key, "inApp")}
                      disabled={cat.required}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Your data" description="Download a copy of everything we keep about you, or delete your account.">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                A JSON file with your profile, registrations, tickets, payments, certificates, notifications and saved events.
              </p>
              <div>
                <Button variant="outline" onClick={handleExport} disabled={isExporting}>
                  {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
                  Download my data
                </Button>
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-destructive/40 p-4">
              <h3 className="text-sm font-semibold text-destructive">Delete my account</h3>
              <p className="text-sm text-muted-foreground">
                Your profile is erased and your upcoming registrations are cancelled. Payment records are kept, without your name, because tax law requires it. This cannot be undone.
              </p>
              <div>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 /> Delete my account
                </Button>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && closeDelete()}>
        <DialogContent className="sm:max-w-110">
          <form onSubmit={handleDelete} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                You will be signed out, your upcoming registrations are cancelled and their tickets stop working. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {account?.hasPassword === false ? (
              <div className="grid gap-1.5">
                <Label htmlFor="delete-confirm">Type DELETE or your email address to confirm</Label>
                <Input id="delete-confirm" autoComplete="off" autoFocus value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="delete-password">Your password</Label>
                <Input id="delete-password" type="password" autoComplete="current-password" autoFocus value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDelete} disabled={isDeleting}>
                Keep my account
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting || !deleteConfirm.trim()}>
                {isDeleting && <Loader2 className="animate-spin" />}
                Delete my account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
