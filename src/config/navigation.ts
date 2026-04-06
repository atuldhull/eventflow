import { ROLES, type Role } from "@/lib/constants"

export interface NavItem {
  label: string
  href: string
  icon: string
  roles: Role[]
}

export const publicNavItems: NavItem[] = [
  { label: "Home", href: "/", icon: "Home", roles: [] },
  { label: "Events", href: "/events", icon: "Calendar", roles: [] },
]

export const dashboardNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", roles: [ROLES.USER, ROLES.VIEWER, ROLES.COORDINATOR, ROLES.EVENT_MANAGER, ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN, ROLES.SUPER_ADMIN] },
  { label: "My Events", href: "/dashboard/events", icon: "Calendar", roles: [ROLES.USER, ROLES.VIEWER, ROLES.COORDINATOR, ROLES.EVENT_MANAGER, ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN, ROLES.SUPER_ADMIN] },
  { label: "My Tickets", href: "/dashboard/tickets", icon: "Ticket", roles: [ROLES.USER, ROLES.VIEWER, ROLES.COORDINATOR, ROLES.EVENT_MANAGER, ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN, ROLES.SUPER_ADMIN] },
  { label: "Profile", href: "/dashboard/profile", icon: "User", roles: [ROLES.USER, ROLES.VIEWER, ROLES.COORDINATOR, ROLES.EVENT_MANAGER, ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN, ROLES.SUPER_ADMIN] },
]

export const adminNavItems: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "LayoutDashboard", roles: [ROLES.EVENT_MANAGER, ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN] },
  { label: "Events", href: "/admin/events", icon: "Calendar", roles: [ROLES.EVENT_MANAGER, ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN] },
  { label: "Attendees", href: "/admin/attendees", icon: "Users", roles: [ROLES.EVENT_MANAGER, ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN] },
  { label: "Analytics", href: "/admin/analytics", icon: "BarChart3", roles: [ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN] },
  { label: "Settings", href: "/admin/settings", icon: "Settings", roles: [ROLES.ORG_ADMIN, ROLES.ENTERPRISE_ADMIN] },
]

export const superAdminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/super-admin", icon: "Shield", roles: [ROLES.SUPER_ADMIN] },
  { label: "Organizations", href: "/super-admin/organizations", icon: "Building2", roles: [ROLES.SUPER_ADMIN] },
  { label: "Users", href: "/super-admin/users", icon: "Users", roles: [ROLES.SUPER_ADMIN] },
  { label: "Events", href: "/super-admin/events", icon: "Calendar", roles: [ROLES.SUPER_ADMIN] },
  { label: "Billing", href: "/super-admin/billing", icon: "CreditCard", roles: [ROLES.SUPER_ADMIN] },
  { label: "System", href: "/super-admin/system", icon: "Server", roles: [ROLES.SUPER_ADMIN] },
]
