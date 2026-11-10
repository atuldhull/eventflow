"use client"

import { useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Pill, type Tone } from "@/components/ui/pill"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getRoleDescription, getRoleLabel } from "@/lib/permissions"
import { MAX_INVITE_EMAILS, emailsFromCsv, parseEmailList } from "@/lib/email-list"
import type { Role } from "@/lib/constants"

type Outcome = "added" | "readded" | "invited" | "already_member" | "invalid"

const OUTCOME: Record<Outcome, { label: string; tone: Tone }> = {
  added: { label: "Added", tone: "positive" },
  readded: { label: "Added back", tone: "positive" },
  invited: { label: "Invited", tone: "info" },
  already_member: { label: "Already a member", tone: "neutral" },
  invalid: { label: "Not a valid address", tone: "negative" },
}

const MAX_CSV_BYTES = 1024 * 1024

/**
 * Invite one or many people (paste a list, or upload a .csv) to an enterprise or an
 * organization through POST /api/members/invite, which applies the role-rank and owner
 * rules per address. People with an account are added straight away; everyone else gets a
 * pending invitation. One address: a toast, and the dialog closes. A list: the dialog shows
 * what happened to each address (added / invited / already a member / not valid).
 */
export function InviteMembersDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  assignableRoles,
  onInvited,
  inputId = "invite-emails",
  description = "People who already have an account are added straight away; everyone else gets an email and joins once they sign up.",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: "ENTERPRISE" | "ORGANIZATION"
  entityId: string | null
  /** roles the inviter may hand out in this enterprise / organization */
  assignableRoles: Role[]
  onInvited?: () => void
  /** id of the address field (tests and labels point at it) */
  inputId?: string
  description?: string
}) {
  const [emailText, setEmailText] = useState("")
  const [inviteRole, setInviteRole] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<{ email: string; outcome: Outcome }[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const { emails, invalid } = parseEmailList(emailText)
  const tooMany = emails.length > MAX_INVITE_EMAILS
  const reset = () => { setEmailText(""); setInviteRole(""); setMessage(""); setError(null); setResults(null) }

  const onCsv = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_CSV_BYTES) { setError("That file is too large (1 MB at most)"); return }
    try {
      const found = emailsFromCsv(await file.text())
      if (found.length === 0) { setError(`No addresses found in ${file.name}`); return }
      setEmailText((t) => [t.trim(), found.join("\n")].filter(Boolean).join("\n"))
      setError(null)
      toast.success(`${found.length} ${found.length === 1 ? "entry" : "entries"} from ${file.name}`)
    } catch {
      setError(`Couldn't read ${file.name}`)
    } finally {
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const handleInvite = async () => {
    if (!entityId) return
    if (emails.length === 0 || tooMany) {
      setError(
        tooMany
          ? `Up to ${MAX_INVITE_EMAILS} addresses at a time (this list has ${emails.length})`
          : invalid.length > 0
            ? `Not an email address: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`
            : "Enter at least one email address"
      )
      return
    }
    if (!inviteRole) { setError("Choose a role"); return }
    setError(null)
    setLoading(true)
    // One clean address keeps the single-invite answer (and its wording); anything else
    // goes as a list so every address gets its own result.
    const single = emails.length === 1 && invalid.length === 0
    try {
      const res = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(single ? { email: emails[0] } : { emails }),
          role: inviteRole,
          entityType,
          entityId,
          message: message.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      const perEmail = data?.data?.results as { email: string; outcome: Outcome }[] | undefined
      if (!data?.success && !perEmail) {
        const msg = data?.message || "Failed to send invitation"
        setError(msg)
        toast.error(msg)
        return
      }
      if (single) {
        toast.success(data.message)
        reset()
        onOpenChange(false)
        onInvited?.()
        return
      }
      const all = [...(perEmail ?? []), ...invalid.map((email) => ({ email, outcome: "invalid" as const }))]
      setResults(all)
      const summary = [data.message, invalid.length > 0 && `${invalid.length} not valid`].filter(Boolean).join(", ")
      if (data.success) { toast.success(`Invitations: ${summary}`); onInvited?.() }
      else toast.error(`Invitations: ${summary}`)
    } catch {
      toast.error("Failed to send invitation")
    } finally {
      setLoading(false)
    }
  }

  const describedBy = error ? "invite-error" : `${inputId}-hint`

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) { if (!next) { setError(null); if (results) reset() } onOpenChange(next) } }}>
      <DialogContent className="sm:max-w-[480px]">
        {results ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Invitations sent</DialogTitle>
              <DialogDescription>
                {(() => {
                  const n = (o: Outcome[]) => results.filter((r) => o.includes(r.outcome)).length
                  return [
                    `${n(["added", "readded"])} added`,
                    `${n(["invited"])} invited`,
                    n(["already_member"]) > 0 && `${n(["already_member"])} already ${n(["already_member"]) === 1 ? "a member" : "members"}`,
                    n(["invalid"]) > 0 && `${n(["invalid"])} not valid`,
                  ].filter(Boolean).join(" · ")
                })()}
              </DialogDescription>
            </DialogHeader>
            <ul className="-mx-1 max-h-72 divide-y overflow-y-auto rounded-lg border" aria-label="Result per address">
              {results.map((r) => (
                <li key={`${r.outcome}-${r.email}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{r.email}</span>
                  <Pill tone={OUTCOME[r.outcome].tone} className="shrink-0">{OUTCOME[r.outcome].label}</Pill>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>Invite more</Button>
              <Button type="button" onClick={() => { reset(); onOpenChange(false) }}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form noValidate onSubmit={(e) => { e.preventDefault(); handleInvite() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Invite team members</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={inputId}>Email addresses</Label>
                  <Button type="button" variant="ghost" size="sm" className="-my-1 -mr-2 text-muted-foreground" onClick={() => fileInput.current?.click()}>
                    <Upload /> Upload .csv
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Upload a .csv of email addresses"
                    onChange={(e) => onCsv(e.target.files?.[0])}
                  />
                </div>
                <Textarea
                  id={inputId}
                  rows={3}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="colleague@example.com, another@example.com"
                  value={emailText}
                  onChange={(e) => { setEmailText(e.target.value); setError(null) }}
                  className="max-h-48"
                  aria-invalid={!!error && (emails.length === 0 || tooMany) ? true : undefined}
                  aria-describedby={describedBy}
                />
                <p id={`${inputId}-hint`} className="text-xs text-muted-foreground tabular-nums">
                  Paste a list (commas, semicolons or new lines) or upload a .csv with an email column. Up to {MAX_INVITE_EMAILS} at a time.
                  {emails.length > 1 && ` ${emails.length} addresses.`}
                  {invalid.length > 0 && (
                    <span className="text-pill-warning-foreground">
                      {" "}{invalid.length} not valid and will be skipped: {invalid.slice(0, 3).join(", ")}{invalid.length > 3 ? "…" : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select items={assignableRoles.map((r) => ({ value: r, label: getRoleLabel(r) }))} value={inviteRole} onValueChange={(v) => { setInviteRole((v as string) || ""); setError(null) }}>
                  <SelectTrigger id="invite-role" className="w-full data-[size=default]:h-9">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        <span className="font-medium">{getRoleLabel(r)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{getRoleDescription(r)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignableRoles.length === 0 && (
                  <p className="text-xs text-muted-foreground">Your role here can&apos;t invite members.</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invite-message">Message <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea id="invite-message" placeholder="Add a message…" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} />
              </div>
              {error && <p id="invite-error" role="alert" className="text-[13px] text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={loading || assignableRoles.length === 0}>
                {loading && <Loader2 className="animate-spin" />}
                {emails.length > 1 ? `Send ${emails.length} invitations` : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
