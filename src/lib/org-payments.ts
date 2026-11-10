import type { Prisma } from "@prisma/client"
import { parseEnumParam } from "@/lib/list-params"

export const PAYMENT_STATUSES = [
  "PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED",
] as const

/**
 * The organization's payments, narrowed by the list's filters. Shared by the payments
 * list and its CSV export so "Export" always downloads exactly what the list shows.
 * The organization scope is applied first and every filter only narrows within it.
 */
export function orgPaymentWhere(
  orgId: string,
  filters: { search?: string; status?: (typeof PAYMENT_STATUSES)[number] }
): Prisma.PaymentWhereInput {
  const { search, status } = filters
  return {
    registration: { event: { organizationId: orgId, deletedAt: null } },
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { paymentNumber: { contains: search, mode: "insensitive" } },
            { gatewayPaymentId: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { event: { title: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  }
}

export function parsePaymentFilters(searchParams: URLSearchParams) {
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100) || undefined
  const status = parseEnumParam(searchParams, "status", PAYMENT_STATUSES)
  return { search, status }
}
