import {
  Award,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CreditCard,
  Globe,
  Heart,
  Home,
  LayoutDashboard,
  Mail,
  Palette,
  ReceiptText,
  ScrollText,
  Settings,
  Shield,
  Ticket,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"
import { PERMISSIONS, type Permission } from "@/lib/permissions"

/**
 * One source of truth for every app navigation surface: the desktop sidebar,
 * the phone bottom bar, the "More" sheet and the jump-to palette.
 * Destinations and permission gates are unchanged from the previous sidebars;
 * the enterprise group is new so its 11 pages are reachable from the shell.
 */
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  permission?: Permission | Permission[]
  /** shown in the phone bottom bar (max 4 per area, the rest live under More) */
  primary?: boolean
  /** exact match only (for overview routes that are prefixes of others) */
  exact?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export type ShellArea = "attendee" | "org" | "enterprise" | "platform"

export const attendeeNav: NavGroup[] = [
  {
    items: [
      { label: "Home", href: "/dashboard", icon: Home, primary: true, exact: true },
      { label: "My events", href: "/dashboard/events", icon: Calendar, primary: true },
      { label: "Tickets", href: "/dashboard/tickets", icon: Ticket, primary: true },
      { label: "Saved", href: "/dashboard/saved", icon: Heart },
      { label: "Certificates", href: "/dashboard/certificates", icon: Award },
      { label: "Payments", href: "/dashboard/payments", icon: ReceiptText },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell, primary: true },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/dashboard/profile", icon: User },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

export const orgNav: NavGroup[] = [
  {
    items: [
      { label: "Overview", href: "/admin/org", icon: LayoutDashboard, primary: true, exact: true },
      { label: "Events", href: "/admin/org/events", icon: Calendar, permission: PERMISSIONS.EVENT_VIEW, primary: true },
      { label: "Registrations", href: "/admin/org/registrations", icon: Ticket, permission: PERMISSIONS.REGISTRATION_VIEW, primary: true },
      { label: "Payments", href: "/admin/org/payments", icon: CreditCard, permission: PERMISSIONS.PAYMENT_VIEW },
    ],
  },
  {
    label: "Engage",
    items: [
      { label: "Communications", href: "/admin/org/communications", icon: Mail, permission: PERMISSIONS.COMMUNICATION_SEND_EMAIL },
      { label: "Certificates", href: "/admin/org/certificates", icon: Award, permission: PERMISSIONS.CERTIFICATE_VIEW },
      { label: "Website", href: "/admin/org/website", icon: Globe, permission: PERMISSIONS.ORG_VIEW },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Members", href: "/admin/org/members", icon: Users, permission: PERMISSIONS.MEMBER_VIEW },
      { label: "Analytics", href: "/admin/org/analytics", icon: BarChart3, permission: PERMISSIONS.ANALYTICS_VIEW_BASIC, primary: true },
      { label: "Audit log", href: "/admin/org/audit-logs", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
      { label: "Settings", href: "/admin/org/settings", icon: Settings, permission: PERMISSIONS.ORG_MANAGE_SETTINGS },
    ],
  },
]

export const enterpriseNav: NavGroup[] = [
  {
    items: [
      { label: "Overview", href: "/admin/enterprise", icon: LayoutDashboard, primary: true, exact: true },
      // each gate is the permission the page's API checks, so read-only enterprise roles
      // (viewer, coordinator, finance) only see pages that will load for them
      { label: "Organizations", href: "/admin/enterprise/organizations", icon: Building2, permission: PERMISSIONS.ORG_VIEW, primary: true },
      { label: "Events", href: "/admin/enterprise/events", icon: Calendar, permission: PERMISSIONS.EVENT_VIEW, primary: true },
      { label: "Registrations", href: "/admin/enterprise/registrations", icon: Ticket, permission: PERMISSIONS.REGISTRATION_VIEW },
      { label: "Payments", href: "/admin/enterprise/payments", icon: CreditCard, permission: PERMISSIONS.PAYMENT_VIEW },
    ],
  },
  {
    label: "Enterprise",
    items: [
      { label: "Members", href: "/admin/enterprise/members", icon: Users, permission: PERMISSIONS.MEMBER_VIEW },
      { label: "Analytics", href: "/admin/enterprise/analytics", icon: BarChart3, permission: PERMISSIONS.ENTERPRISE_VIEW_ANALYTICS, primary: true },
      { label: "Audit log", href: "/admin/enterprise/audit-logs", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
      { label: "Billing", href: "/admin/enterprise/billing", icon: ReceiptText, permission: PERMISSIONS.ENTERPRISE_MANAGE_BILLING },
      { label: "Branding", href: "/admin/enterprise/branding", icon: Palette, permission: PERMISSIONS.ENTERPRISE_EDIT },
      { label: "Settings", href: "/admin/enterprise/settings", icon: Settings, permission: PERMISSIONS.ENTERPRISE_MANAGE_SETTINGS },
    ],
  },
]

export const platformNav: NavGroup[] = [
  {
    items: [
      { label: "Overview", href: "/super-admin", icon: Shield, primary: true, exact: true },
      { label: "Enterprises", href: "/super-admin/enterprises", icon: Building2, primary: true },
      { label: "Organizations", href: "/super-admin/organizations", icon: Building2 },
      { label: "Events", href: "/super-admin/events", icon: Calendar, primary: true },
      { label: "Users", href: "/super-admin/users", icon: Users, primary: true },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
      { label: "Messages", href: "/super-admin/messages", icon: Mail },
      { label: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
      { label: "Audit log", href: "/super-admin/audit", icon: ScrollText },
      { label: "Settings", href: "/super-admin/settings", icon: Settings },
    ],
  },
]

export const navByArea: Record<ShellArea, NavGroup[]> = {
  attendee: attendeeNav,
  org: orgNav,
  enterprise: enterpriseNav,
  platform: platformNav,
}

export const areaLabel: Record<ShellArea, string> = {
  attendee: "My EventFlow",
  org: "Organization",
  enterprise: "Enterprise",
  platform: "Platform admin",
}

/** Which shell area a pathname belongs to. */
export function areaForPath(pathname: string): ShellArea {
  if (pathname.startsWith("/super-admin")) return "platform"
  if (pathname.startsWith("/admin/enterprise")) return "enterprise"
  if (pathname.startsWith("/admin")) return "org"
  return "attendee"
}

export function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")
}

/** Filter a nav tree by permission; empty groups are dropped. */
export function filterNav(
  groups: NavGroup[],
  allow: (p: Permission[]) => boolean,
): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.permission || allow(Array.isArray(i.permission) ? i.permission : [i.permission])),
    }))
    .filter((g) => g.items.length > 0)
}
