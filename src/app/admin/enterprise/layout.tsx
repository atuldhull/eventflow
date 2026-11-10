"use client"

import Link from "next/link"
import { ShieldOff } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button, buttonVariants } from "@/components/ui/button"
import { useRBAC } from "@/hooks/useRBAC"
import { useMounted } from "@/hooks/useMounted"

/**
 * Every /admin/enterprise/* page works on the current enterprise. When the signed-in user
 * has no access to it (not a member, removed, the enterprise was deactivated, or they
 * belong to no enterprise at all) the pages would wait forever for an id they never get,
 * so say so instead. Access comes from /api/auth/permissions (the role held IN the
 * enterprise); the API routes enforce it again on every call.
 */
export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const mounted = useMounted()
  const { isLoading, currentEnterpriseId, accessibleEnterprises, enterpriseRole, setEnterpriseContext } = useRBAC()

  // until the permissions arrive the pages show their own loading skeletons
  if (!mounted || isLoading) return <>{children}</>

  const current = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)
  const noEnterprises = accessibleEnterprises.length === 0
  // no enterprise selected yet: the shell selects the first accessible one
  if (!noEnterprises && !currentEnterpriseId) return <>{children}</>
  if (current && enterpriseRole) return <>{children}</>

  const other = accessibleEnterprises.find((e) => e.id !== currentEnterpriseId)
  return (
    <EmptyState
      variant="page"
      icon={ShieldOff}
      title={noEnterprises ? "You don't have access to an enterprise" : "You don't have access to this enterprise"}
      description={
        noEnterprises
          ? "Enterprise tools are for members of an enterprise. Ask an enterprise admin to invite you."
          : "You're not a member of it any more, or it has been deactivated. Ask an enterprise admin if you think this is a mistake."
      }
    >
      {other && (
        <Button onClick={() => setEnterpriseContext(other.id)}>Open {other.name}</Button>
      )}
      <Link href="/admin" className={buttonVariants({ variant: other ? "outline" : "default" })}>Back to workspaces</Link>
    </EmptyState>
  )
}
