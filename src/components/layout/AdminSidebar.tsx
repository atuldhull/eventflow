"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Calendar,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  Building2,
  Mail,
  Award,
  ScrollText,
  Ticket,
  ChevronLeft,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS, getRoleLabel, getRoleColor } from "@/lib/permissions"
import type { Permission } from "@/lib/permissions"
import { ContextSwitcher } from "@/components/shared/ContextSwitcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUIStore } from "@/stores/useUIStore"
import { signOut } from "next-auth/react"
import type { Role } from "@/lib/constants"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  permission?: Permission | Permission[]
}

const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/org", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Events", href: "/admin/org/events", icon: <Calendar className="h-4 w-4" />, permission: PERMISSIONS.EVENT_VIEW },
  { label: "Registrations", href: "/admin/org/registrations", icon: <Ticket className="h-4 w-4" />, permission: PERMISSIONS.REGISTRATION_VIEW },
  { label: "Payments", href: "/admin/org/payments", icon: <CreditCard className="h-4 w-4" />, permission: PERMISSIONS.PAYMENT_VIEW },
  { label: "Communications", href: "/admin/org/communications", icon: <Mail className="h-4 w-4" />, permission: PERMISSIONS.COMMUNICATION_SEND_EMAIL },
  { label: "Certificates", href: "/admin/org/certificates", icon: <Award className="h-4 w-4" />, permission: PERMISSIONS.CERTIFICATE_VIEW },
  { label: "Members", href: "/admin/org/members", icon: <Users className="h-4 w-4" />, permission: PERMISSIONS.MEMBER_VIEW },
  { label: "Analytics", href: "/admin/org/analytics", icon: <BarChart3 className="h-4 w-4" />, permission: PERMISSIONS.ANALYTICS_VIEW_BASIC },
  { label: "Audit Logs", href: "/admin/org/audit-logs", icon: <ScrollText className="h-4 w-4" />, permission: PERMISSIONS.AUDIT_VIEW },
  { label: "Settings", href: "/admin/org/settings", icon: <Settings className="h-4 w-4" />, permission: PERMISSIONS.ORG_MANAGE_SETTINGS },
]

const superAdminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/super-admin", icon: <Shield className="h-4 w-4" /> },
  { label: "Enterprises", href: "/super-admin/enterprises", icon: <Building2 className="h-4 w-4" /> },
  { label: "Users", href: "/super-admin/users", icon: <Users className="h-4 w-4" /> },
  { label: "Analytics", href: "/super-admin/analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Settings", href: "/super-admin/settings", icon: <Settings className="h-4 w-4" /> },
  { label: "Audit Logs", href: "/super-admin/audit", icon: <ScrollText className="h-4 w-4" /> },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { hasPermission, hasAnyPermission, isSuperAdmin, role } = usePermissions()
  const { sidebarOpen, toggleSidebar } = useUIStore()

  // Show org/enterprise nav items when super admin is in an org/enterprise context
  const isInOrgContext = pathname.startsWith("/admin/org") || pathname.startsWith("/admin/enterprise") || pathname.startsWith("/admin/events")
  const navItems = (isSuperAdmin && !isInOrgContext) ? superAdminNavItems : adminNavItems

  const filteredItems = navItems.filter((item) => {
    if (!item.permission) return true
    const perms = Array.isArray(item.permission) ? item.permission : [item.permission]
    return isSuperAdmin || hasAnyPermission(perms)
  })

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar transition-all duration-200",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {sidebarOpen && (
          <Link href="/" className="text-lg font-bold text-sidebar-foreground">
            EventFlow
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0">
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
        </Button>
      </div>

      {/* Context Switcher */}
      {sidebarOpen && (!isSuperAdmin || isInOrgContext) && (
        <div className="border-b p-3">
          <ContextSwitcher />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!sidebarOpen ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  !sidebarOpen && "justify-center px-2"
                )}
              >
                {item.icon}
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t p-3">
        {sidebarOpen ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {session?.user?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{session?.user?.name}</p>
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", getRoleColor(role))}>
                  {getRoleLabel(role)}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  )
}
