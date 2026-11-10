import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

/**
 * Payments whose money was received at some point. A refunded or partly refunded payment
 * still counts as collected; what went back is counted separately as refunds, so
 * net = collected - refunds. (Summing only COMPLETED payments dropped the kept part of a
 * partial refund, and subtracting refunds from that total counted every refund twice.)
 */
export const COLLECTED_PAYMENT_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] as const

export type RevenueTotals = { gross: number; refunds: number; net: number }

export const isCollected = (status: string) => (COLLECTED_PAYMENT_STATUSES as readonly string[]).includes(status)

/** Money kept from one payment: what was paid minus what was refunded. */
export const netAmount = (p: { amount: Prisma.Decimal | number | string; refundAmount?: Prisma.Decimal | number | string | null }) =>
  Number(p.amount) - Number(p.refundAmount ?? 0)

/** Collected, refunded and net totals of the payments matching `where`. */
export async function revenueTotals(where: Prisma.PaymentWhereInput): Promise<RevenueTotals> {
  const agg = await prisma.payment.aggregate({
    where: { ...where, status: { in: [...COLLECTED_PAYMENT_STATUSES] } },
    _sum: { amount: true, refundAmount: true },
  })
  const gross = Number(agg._sum?.amount ?? 0)
  const refunds = Number(agg._sum?.refundAmount ?? 0)
  return { gross, refunds, net: Math.round((gross - refunds) * 100) / 100 }
}
