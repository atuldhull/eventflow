import type { Role } from "@/lib/constants"

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

export const PERMISSIONS = {
  // Enterprise
  ENTERPRISE_VIEW: "enterprise:view",
  ENTERPRISE_EDIT: "enterprise:edit",
  ENTERPRISE_DELETE: "enterprise:delete",
  ENTERPRISE_MANAGE_BILLING: "enterprise:manage_billing",
  ENTERPRISE_MANAGE_SETTINGS: "enterprise:manage_settings",
  ENTERPRISE_VIEW_ANALYTICS: "enterprise:view_analytics",
  ENTERPRISE_EXPORT_DATA: "enterprise:export_data",

  // Organization
  ORG_CREATE: "org:create",
  ORG_VIEW: "org:view",
  ORG_EDIT: "org:edit",
  ORG_DELETE: "org:delete",
  ORG_MANAGE_SETTINGS: "org:manage_settings",
  ORG_VIEW_ANALYTICS: "org:view_analytics",

  // Members
  MEMBER_VIEW: "member:view",
  MEMBER_INVITE: "member:invite",
  MEMBER_REMOVE: "member:remove",
  MEMBER_CHANGE_ROLE: "member:change_role",

  // Events
  EVENT_CREATE: "event:create",
  EVENT_VIEW: "event:view",
  EVENT_EDIT: "event:edit",
  EVENT_DELETE: "event:delete",
  EVENT_PUBLISH: "event:publish",
  EVENT_CANCEL: "event:cancel",
  EVENT_DUPLICATE: "event:duplicate",
  EVENT_MANAGE_SESSIONS: "event:manage_sessions",
  EVENT_MANAGE_SPONSORS: "event:manage_sponsors",
  EVENT_MANAGE_FAQS: "event:manage_faqs",
  EVENT_MANAGE_FORM: "event:manage_form",
  EVENT_VIEW_ANALYTICS: "event:view_analytics",
  EVENT_EXPORT_DATA: "event:export_data",

  // Registrations
  REGISTRATION_VIEW: "registration:view",
  REGISTRATION_MANAGE: "registration:manage",
  REGISTRATION_APPROVE: "registration:approve",
  REGISTRATION_REJECT: "registration:reject",
  REGISTRATION_CANCEL: "registration:cancel",
  REGISTRATION_EXPORT: "registration:export",
  REGISTRATION_IMPORT: "registration:import",
  REGISTRATION_ADD_MANUAL: "registration:add_manual",

  // Payments
  PAYMENT_VIEW: "payment:view",
  PAYMENT_MANAGE: "payment:manage",
  PAYMENT_REFUND: "payment:refund",
  PAYMENT_EXPORT: "payment:export",
  PAYMENT_VIEW_REPORTS: "payment:view_reports",

  // Check-in
  CHECKIN_PERFORM: "checkin:perform",
  CHECKIN_VIEW: "checkin:view",
  CHECKIN_MANAGE: "checkin:manage",
  CHECKIN_UNDO: "checkin:undo",

  // Communication
  COMMUNICATION_SEND_EMAIL: "communication:send_email",
  COMMUNICATION_SEND_SMS: "communication:send_sms",
  COMMUNICATION_SEND_ANNOUNCEMENT: "communication:send_announcement",
  COMMUNICATION_VIEW_HISTORY: "communication:view_history",

  // Certificates
  CERTIFICATE_CREATE_TEMPLATE: "certificate:create_template",
  CERTIFICATE_GENERATE: "certificate:generate",
  CERTIFICATE_VIEW: "certificate:view",
  CERTIFICATE_MANAGE: "certificate:manage",

  // Coupons
  COUPON_CREATE: "coupon:create",
  COUPON_VIEW: "coupon:view",
  COUPON_EDIT: "coupon:edit",
  COUPON_DELETE: "coupon:delete",

  // Analytics
  ANALYTICS_VIEW_BASIC: "analytics:view_basic",
  ANALYTICS_VIEW_ADVANCED: "analytics:view_advanced",
  ANALYTICS_EXPORT: "analytics:export",

  // Audit
  AUDIT_VIEW: "audit:view",
  AUDIT_EXPORT: "audit:export",

  // Platform (Super Admin only)
  PLATFORM_MANAGE_USERS: "platform:manage_users",
  PLATFORM_MANAGE_ENTERPRISES: "platform:manage_enterprises",
  PLATFORM_MANAGE_SUBSCRIPTIONS: "platform:manage_subscriptions",
  PLATFORM_VIEW_ALL_ANALYTICS: "platform:view_all_analytics",
  PLATFORM_MANAGE_SETTINGS: "platform:manage_settings",
  PLATFORM_MANAGE_CONTENT: "platform:manage_content",
  PLATFORM_IMPERSONATE: "platform:impersonate",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ============================================================================
// ALL PERMISSIONS ARRAY
// ============================================================================

const ALL_PERMISSIONS = Object.values(PERMISSIONS)

// ============================================================================
// ROLE → PERMISSIONS MAPPING
// ============================================================================

const ENTERPRISE_LEVEL_PERMISSIONS: Permission[] = [
  PERMISSIONS.ENTERPRISE_VIEW,
  PERMISSIONS.ENTERPRISE_EDIT,
  PERMISSIONS.ENTERPRISE_MANAGE_SETTINGS,
  PERMISSIONS.ENTERPRISE_VIEW_ANALYTICS,
  PERMISSIONS.ENTERPRISE_EXPORT_DATA,
  PERMISSIONS.ORG_CREATE,
  PERMISSIONS.ORG_VIEW,
  PERMISSIONS.ORG_EDIT,
  PERMISSIONS.ORG_DELETE,
  PERMISSIONS.ORG_MANAGE_SETTINGS,
  PERMISSIONS.ORG_VIEW_ANALYTICS,
]

const MEMBER_MANAGEMENT_PERMISSIONS: Permission[] = [
  PERMISSIONS.MEMBER_VIEW,
  PERMISSIONS.MEMBER_INVITE,
  PERMISSIONS.MEMBER_REMOVE,
  PERMISSIONS.MEMBER_CHANGE_ROLE,
]

const EVENT_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.EVENT_CREATE,
  PERMISSIONS.EVENT_VIEW,
  PERMISSIONS.EVENT_EDIT,
  PERMISSIONS.EVENT_DELETE,
  PERMISSIONS.EVENT_PUBLISH,
  PERMISSIONS.EVENT_CANCEL,
  PERMISSIONS.EVENT_DUPLICATE,
  PERMISSIONS.EVENT_MANAGE_SESSIONS,
  PERMISSIONS.EVENT_MANAGE_SPONSORS,
  PERMISSIONS.EVENT_MANAGE_FAQS,
  PERMISSIONS.EVENT_MANAGE_FORM,
  PERMISSIONS.EVENT_VIEW_ANALYTICS,
  PERMISSIONS.EVENT_EXPORT_DATA,
]

const REGISTRATION_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.REGISTRATION_VIEW,
  PERMISSIONS.REGISTRATION_MANAGE,
  PERMISSIONS.REGISTRATION_APPROVE,
  PERMISSIONS.REGISTRATION_REJECT,
  PERMISSIONS.REGISTRATION_CANCEL,
  PERMISSIONS.REGISTRATION_EXPORT,
  PERMISSIONS.REGISTRATION_IMPORT,
  PERMISSIONS.REGISTRATION_ADD_MANUAL,
]

const PAYMENT_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_MANAGE,
  PERMISSIONS.PAYMENT_REFUND,
  PERMISSIONS.PAYMENT_EXPORT,
  PERMISSIONS.PAYMENT_VIEW_REPORTS,
]

const CHECKIN_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.CHECKIN_PERFORM,
  PERMISSIONS.CHECKIN_VIEW,
  PERMISSIONS.CHECKIN_MANAGE,
  PERMISSIONS.CHECKIN_UNDO,
]

const COMMUNICATION_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.COMMUNICATION_SEND_EMAIL,
  PERMISSIONS.COMMUNICATION_SEND_SMS,
  PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT,
  PERMISSIONS.COMMUNICATION_VIEW_HISTORY,
]

const CERTIFICATE_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.CERTIFICATE_CREATE_TEMPLATE,
  PERMISSIONS.CERTIFICATE_GENERATE,
  PERMISSIONS.CERTIFICATE_VIEW,
  PERMISSIONS.CERTIFICATE_MANAGE,
]

const COUPON_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.COUPON_CREATE,
  PERMISSIONS.COUPON_VIEW,
  PERMISSIONS.COUPON_EDIT,
  PERMISSIONS.COUPON_DELETE,
]

const ANALYTICS_FULL_PERMISSIONS: Permission[] = [
  PERMISSIONS.ANALYTICS_VIEW_BASIC,
  PERMISSIONS.ANALYTICS_VIEW_ADVANCED,
  PERMISSIONS.ANALYTICS_EXPORT,
]

const AUDIT_PERMISSIONS: Permission[] = [
  PERMISSIONS.AUDIT_VIEW,
  PERMISSIONS.AUDIT_EXPORT,
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  ENTERPRISE_ADMIN: [
    ...ENTERPRISE_LEVEL_PERMISSIONS,
    PERMISSIONS.ENTERPRISE_DELETE,
    PERMISSIONS.ENTERPRISE_MANAGE_BILLING,
    ...MEMBER_MANAGEMENT_PERMISSIONS,
    ...EVENT_FULL_PERMISSIONS,
    ...REGISTRATION_FULL_PERMISSIONS,
    ...PAYMENT_FULL_PERMISSIONS,
    ...CHECKIN_FULL_PERMISSIONS,
    ...COMMUNICATION_FULL_PERMISSIONS,
    ...CERTIFICATE_FULL_PERMISSIONS,
    ...COUPON_FULL_PERMISSIONS,
    ...ANALYTICS_FULL_PERMISSIONS,
    ...AUDIT_PERMISSIONS,
  ],

  ENTERPRISE_MANAGER: [
    ...ENTERPRISE_LEVEL_PERMISSIONS,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    ...EVENT_FULL_PERMISSIONS,
    ...REGISTRATION_FULL_PERMISSIONS,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_VIEW_REPORTS,
    ...CHECKIN_FULL_PERMISSIONS,
    ...COMMUNICATION_FULL_PERMISSIONS,
    ...CERTIFICATE_FULL_PERMISSIONS,
    ...COUPON_FULL_PERMISSIONS,
    PERMISSIONS.ANALYTICS_VIEW_BASIC,
    PERMISSIONS.ANALYTICS_VIEW_ADVANCED,
    PERMISSIONS.AUDIT_VIEW,
  ],

  ORG_ADMIN: [
    // an ORG_ADMIN role held on an enterprise membership opens the enterprise hub read-only
    PERMISSIONS.ENTERPRISE_VIEW,
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_EDIT,
    PERMISSIONS.ORG_MANAGE_SETTINGS,
    PERMISSIONS.ORG_VIEW_ANALYTICS,
    ...MEMBER_MANAGEMENT_PERMISSIONS,
    ...EVENT_FULL_PERMISSIONS,
    ...REGISTRATION_FULL_PERMISSIONS,
    ...PAYMENT_FULL_PERMISSIONS,
    ...CHECKIN_FULL_PERMISSIONS,
    ...COMMUNICATION_FULL_PERMISSIONS,
    ...CERTIFICATE_FULL_PERMISSIONS,
    ...COUPON_FULL_PERMISSIONS,
    ...ANALYTICS_FULL_PERMISSIONS,
    ...AUDIT_PERMISSIONS,
  ],

  EVENT_MANAGER: [
    // to open the workspace (enterprise hub, organization) it works in, read-only
    PERMISSIONS.ENTERPRISE_VIEW,
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.EVENT_CREATE,
    PERMISSIONS.EVENT_VIEW,
    PERMISSIONS.EVENT_EDIT,
    PERMISSIONS.EVENT_PUBLISH,
    PERMISSIONS.EVENT_CANCEL,
    PERMISSIONS.EVENT_DUPLICATE,
    PERMISSIONS.EVENT_MANAGE_SESSIONS,
    PERMISSIONS.EVENT_MANAGE_SPONSORS,
    PERMISSIONS.EVENT_MANAGE_FAQS,
    PERMISSIONS.EVENT_MANAGE_FORM,
    PERMISSIONS.EVENT_VIEW_ANALYTICS,
    PERMISSIONS.EVENT_EXPORT_DATA,
    PERMISSIONS.REGISTRATION_VIEW,
    PERMISSIONS.REGISTRATION_MANAGE,
    PERMISSIONS.REGISTRATION_APPROVE,
    PERMISSIONS.REGISTRATION_REJECT,
    PERMISSIONS.REGISTRATION_EXPORT,
    PERMISSIONS.REGISTRATION_ADD_MANUAL,
    // event staff run the door too: scan, manual check-in and its undo
    PERMISSIONS.CHECKIN_PERFORM,
    PERMISSIONS.CHECKIN_VIEW,
    PERMISSIONS.COMMUNICATION_SEND_EMAIL,
    PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT,
    PERMISSIONS.COMMUNICATION_VIEW_HISTORY,
    PERMISSIONS.CERTIFICATE_VIEW,
    PERMISSIONS.COUPON_CREATE,
    PERMISSIONS.COUPON_VIEW,
    PERMISSIONS.COUPON_EDIT,
    PERMISSIONS.ANALYTICS_VIEW_BASIC,
  ],

  // The read-mostly roles also get the workspace read permissions their names imply, so an
  // enterprise (or organization) COORDINATOR, FINANCE_MANAGER or VIEWER can open the hub
  // and its lists read-only. Every write stays with the roles above.
  COORDINATOR: [
    PERMISSIONS.ENTERPRISE_VIEW,
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.EVENT_VIEW,
    PERMISSIONS.REGISTRATION_VIEW,
    PERMISSIONS.CHECKIN_PERFORM,
    PERMISSIONS.CHECKIN_VIEW,
    PERMISSIONS.ANALYTICS_VIEW_BASIC,
  ],

  FINANCE_MANAGER: [
    PERMISSIONS.ENTERPRISE_VIEW,
    PERMISSIONS.ENTERPRISE_VIEW_ANALYTICS,
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_VIEW_ANALYTICS,
    PERMISSIONS.EVENT_VIEW_ANALYTICS,
    PERMISSIONS.EVENT_VIEW,
    PERMISSIONS.REGISTRATION_VIEW,
    ...PAYMENT_FULL_PERMISSIONS,
    PERMISSIONS.COUPON_CREATE,
    PERMISSIONS.COUPON_VIEW,
    PERMISSIONS.COUPON_EDIT,
    PERMISSIONS.ANALYTICS_VIEW_BASIC,
    PERMISSIONS.ANALYTICS_VIEW_ADVANCED,
    PERMISSIONS.ANALYTICS_EXPORT,
  ],

  VIEWER: [
    PERMISSIONS.ENTERPRISE_VIEW,
    PERMISSIONS.ENTERPRISE_VIEW_ANALYTICS,
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_VIEW_ANALYTICS,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.EVENT_VIEW,
    PERMISSIONS.EVENT_VIEW_ANALYTICS,
    PERMISSIONS.REGISTRATION_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.CHECKIN_VIEW,
    PERMISSIONS.ANALYTICS_VIEW_BASIC,
  ],

  USER: [],
}

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 100,
  ENTERPRISE_ADMIN: 90,
  ENTERPRISE_MANAGER: 80,
  ORG_ADMIN: 70,
  EVENT_MANAGER: 60,
  COORDINATOR: 50,
  FINANCE_MANAGER: 50,
  VIEWER: 40,
  USER: 0,
}

const MANAGEABLE_ROLES: Record<Role, Role[]> = {
  SUPER_ADMIN: ["ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER", "USER"],
  ENTERPRISE_ADMIN: ["ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER"],
  ENTERPRISE_MANAGER: ["ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER"],
  ORG_ADMIN: ["EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER"],
  EVENT_MANAGER: ["COORDINATOR"],
  COORDINATOR: [],
  FINANCE_MANAGER: [],
  VIEWER: [],
  USER: [],
}

const ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ENTERPRISE_ADMIN",
  "ENTERPRISE_MANAGER",
  "ORG_ADMIN",
  "EVENT_MANAGER",
  "COORDINATOR",
  "FINANCE_MANAGER",
  "VIEWER",
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function hasPermission(userPermissions: Permission[], required: Permission): boolean {
  return userPermissions.includes(required)
}

export function hasAnyPermission(userPermissions: Permission[], required: Permission[]): boolean {
  return required.some((p) => userPermissions.includes(p))
}

export function hasAllPermissions(userPermissions: Permission[], required: Permission[]): boolean {
  return required.every((p) => userPermissions.includes(p))
}

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}

export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole]
}

export function getManageableRoles(role: Role): Role[] {
  return MANAGEABLE_ROLES[role] || []
}

/**
 * The role-rank rule for ENTERPRISE memberships: canManageRole, plus one exception: the
 * enterprise's owner (an ENTERPRISE_ADMIN) may invite, re-role and remove co-admins
 * (other ENTERPRISE_ADMINs). Nobody else can grant or manage a role equal to their own.
 */
export function canManageEnterpriseRole(managerRole: Role, targetRole: Role, managerIsOwner: boolean): boolean {
  if (canManageRole(managerRole, targetRole)) return true
  return managerIsOwner && managerRole === "ENTERPRISE_ADMIN" && targetRole === "ENTERPRISE_ADMIN"
}

/** Roles an enterprise member may hand out (invite or role change); the owner can add co-admins. */
export function getAssignableEnterpriseRoles(role: Role | null | undefined, isOwner: boolean): Role[] {
  if (!role) return []
  const roles = getManageableRoles(role).filter((r) => r !== "SUPER_ADMIN" && r !== "USER")
  if (role === "SUPER_ADMIN" || (isOwner && role === "ENTERPRISE_ADMIN")) {
    return ["ENTERPRISE_ADMIN", ...roles.filter((r) => r !== "ENTERPRISE_ADMIN")]
  }
  return roles
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    SUPER_ADMIN: "Super Admin",
    ENTERPRISE_ADMIN: "Enterprise Admin",
    ENTERPRISE_MANAGER: "Enterprise Manager",
    ORG_ADMIN: "Organization Admin",
    EVENT_MANAGER: "Event Manager",
    COORDINATOR: "Coordinator",
    FINANCE_MANAGER: "Finance Manager",
    VIEWER: "Viewer",
    USER: "User",
  }
  return labels[role] || role
}

export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    SUPER_ADMIN: "Full platform access. Manages all enterprises, organizations, and system settings.",
    ENTERPRISE_ADMIN: "Full access within the enterprise. Manages organizations, members, and billing.",
    ENTERPRISE_MANAGER: "Manages organizations, events, and members within the enterprise.",
    ORG_ADMIN: "Full access within the organization. Manages events, members, and settings.",
    EVENT_MANAGER: "Creates and manages events, registrations, and communications.",
    COORDINATOR: "Event day operations. Check-in participants and view event details.",
    FINANCE_MANAGER: "Manages payments, refunds, and financial reports.",
    VIEWER: "Read-only access to events, registrations, and analytics.",
    USER: "Regular user. Can browse and register for events.",
  }
  return descriptions[role] || ""
}

export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    SUPER_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    ENTERPRISE_ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    ENTERPRISE_MANAGER: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    ORG_ADMIN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    EVENT_MANAGER: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    COORDINATOR: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
    FINANCE_MANAGER: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    VIEWER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    USER: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400",
  }
  return colors[role] || ""
}
