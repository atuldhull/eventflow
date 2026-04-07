export const APP_NAME = "EventFlow"

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ENTERPRISE_ADMIN: "ENTERPRISE_ADMIN",
  ENTERPRISE_MANAGER: "ENTERPRISE_MANAGER",
  ORG_ADMIN: "ORG_ADMIN",
  EVENT_MANAGER: "EVENT_MANAGER",
  COORDINATOR: "COORDINATOR",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  VIEWER: "VIEWER",
  USER: "USER",
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const EVENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const

export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS]

export const REGISTRATION_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  WAITLISTED: "WAITLISTED",
  CANCELLED: "CANCELLED",
  CHECKED_IN: "CHECKED_IN",
} as const

export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS]

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  REFUNDED: "REFUNDED",
  FAILED: "FAILED",
} as const

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

export const TICKET_TYPES = {
  FREE: "FREE",
  PAID: "PAID",
  VIP: "VIP",
  EARLY_BIRD: "EARLY_BIRD",
} as const

export type TicketType = (typeof TICKET_TYPES)[keyof typeof TICKET_TYPES]

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const
