import { ROLES, type Role } from "@/lib/constants"
import type { Permission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/permissions"

export interface NavItem {
  label: string
  href: string
  icon: string
  roles?: Role[]
  permission?: Permission | Permission[]
  children?: NavItem[]
  badge?: string
}

// Public navigation (no auth required)
export const publicNavItems: NavItem[] = [
  { label: "Home", href: "/", icon: "Home" },
  { label: "Events", href: "/events", icon: "Calendar" },
]

// User dashboard navigation
export const dashboardNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "My Events", href: "/dashboard/events", icon: "Calendar" },
  { label: "My Tickets", href: "/dashboard/tickets", icon: "Ticket" },
  { label: "Certificates", href: "/dashboard/certificates", icon: "Award" },
  { label: "Payments", href: "/dashboard/payments", icon: "CreditCard" },
  { label: "Profile", href: "/dashboard/profile", icon: "User" },
]

// Admin panel navigation (permission-based)
export const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "LayoutDashboard" },
  {
    label: "Events",
    href: "/admin/events",
    icon: "Calendar",
    permission: PERMISSIONS.EVENT_VIEW,
    children: [
      { label: "All Events", href: "/admin/events", icon: "List", permission: PERMISSIONS.EVENT_VIEW },
      { label: "Create Event", href: "/admin/events/create", icon: "Plus", permission: PERMISSIONS.EVENT_CREATE },
    ],
  },
  {
    label: "Registrations",
    href: "/admin/registrations",
    icon: "Ticket",
    permission: PERMISSIONS.REGISTRATION_VIEW,
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: "CreditCard",
    permission: PERMISSIONS.PAYMENT_VIEW,
  },
  {
    label: "Communications",
    href: "/admin/communications",
    icon: "Mail",
    permission: PERMISSIONS.COMMUNICATION_SEND_EMAIL,
  },
  {
    label: "Certificates",
    href: "/admin/certificates",
    icon: "Award",
    permission: PERMISSIONS.CERTIFICATE_VIEW,
  },
  {
    label: "Members",
    href: "/admin/members",
    icon: "Users",
    permission: PERMISSIONS.MEMBER_VIEW,
  },
  {
    label: "Organizations",
    href: "/admin/organizations",
    icon: "Building2",
    permission: PERMISSIONS.ORG_VIEW,
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: "BarChart3",
    permission: PERMISSIONS.ANALYTICS_VIEW_BASIC,
  },
  {
    label: "Audit Logs",
    href: "/admin/audit",
    icon: "ScrollText",
    permission: PERMISSIONS.AUDIT_VIEW,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: "Settings",
    permission: [PERMISSIONS.ORG_MANAGE_SETTINGS, PERMISSIONS.ENTERPRISE_MANAGE_SETTINGS],
  },
]

// Super admin navigation
export const superAdminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/super-admin", icon: "Shield" },
  { label: "Enterprises", href: "/super-admin/enterprises", icon: "Building2" },
  { label: "Users", href: "/super-admin/users", icon: "Users" },
  { label: "Subscriptions", href: "/super-admin/subscriptions", icon: "CreditCard" },
  { label: "Analytics", href: "/super-admin/analytics", icon: "BarChart3" },
  { label: "Settings", href: "/super-admin/settings", icon: "Settings" },
  { label: "Audit Logs", href: "/super-admin/audit", icon: "ScrollText" },
]
