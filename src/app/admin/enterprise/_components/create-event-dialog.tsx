"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useRBAC } from "@/hooks/useRBAC"

interface OrgOption { id: string; name: string; isActive: boolean }

/**
 * Events are created inside an organization, so this asks which one, switches the admin
 * context to it, and opens the organization's event wizard.
 */
export function CreateEventDialog({
  open,
  onOpenChange,
  enterpriseId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  enterpriseId: string | null
}) {
  const router = useRouter()
  const { setOrganizationContext } = useRBAC()
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null)
  const [orgId, setOrgId] = useState("")
  const [going, setGoing] = useState(false)

  useEffect(() => {
    if (!open || !enterpriseId) return
    let cancelled = false
    fetch(`/api/admin/enterprise/${enterpriseId}/organizations?page=1&limit=100`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const list: OrgOption[] = json.success ? json.data.filter((o: OrgOption) => o.isActive) : []
        setOrgs(list)
        if (list.length === 1) setOrgId(list[0].id)
      })
      .catch(() => { if (!cancelled) setOrgs([]) })
    return () => { cancelled = true }
  }, [open, enterpriseId])

  const go = () => {
    if (!orgId) return
    setGoing(true)
    setOrganizationContext(orgId)
    router.push("/admin/org/events/create")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!going) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-[440px]">
        <form noValidate onSubmit={(e) => { e.preventDefault(); go() }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create an event</DialogTitle>
            <DialogDescription>Events belong to an organization. Pick the one that runs this event.</DialogDescription>
          </DialogHeader>

          {orgs === null ? (
            <div className="grid gap-1.5" aria-busy>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : orgs.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              There are no active organizations yet. Create one first, then add events to it.
            </p>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="event-org">Organization</Label>
              <Select items={orgs.map((o) => ({ value: o.id, label: o.name }))} value={orgId} onValueChange={(v) => setOrgId((v as string) || "")}>
                <SelectTrigger id="event-org" className="w-full data-[size=default]:h-9">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={going}>Cancel</Button>
            {orgs && orgs.length === 0 ? (
              <Link href="/admin/enterprise/organizations/create" className={buttonVariants()}>Create organization</Link>
            ) : (
              <Button type="submit" disabled={!orgId || going}>
                {going && <Loader2 className="animate-spin" />}
                Continue
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
