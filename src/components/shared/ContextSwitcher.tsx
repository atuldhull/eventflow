"use client"

import { useState } from "react"
import { ChevronDown, Building2, Users, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

export function ContextSwitcher() {
  const {
    accessibleEnterprises,
    accessibleOrganizations,
    currentEnterpriseId,
    currentOrganizationId,
    setEnterpriseContext,
    setOrganizationContext,
    can,
  } = useRBAC()
  const [open, setOpen] = useState(false)

  const currentEnterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)
  const currentOrg = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const displayName = currentOrg?.name || currentEnterprise?.name || "Select context"

  const filteredOrgs = currentEnterpriseId
    ? accessibleOrganizations.filter((o) => o.enterpriseId === currentEnterpriseId)
    : accessibleOrganizations

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="w-full justify-between gap-2 text-left" />
        }
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{displayName}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {accessibleEnterprises.length > 0 && (
          <div className="mb-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Enterprises</p>
            {accessibleEnterprises.map((enterprise) => (
              <button
                key={enterprise.id}
                onClick={() => {
                  setEnterpriseContext(enterprise.id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  enterprise.id === currentEnterpriseId && "bg-accent"
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{enterprise.name}</span>
              </button>
            ))}
          </div>
        )}

        {filteredOrgs.length > 0 && (
          <div>
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Organizations</p>
            {filteredOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setOrganizationContext(org.id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  org.id === currentOrganizationId && "bg-accent"
                )}
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{org.name}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
