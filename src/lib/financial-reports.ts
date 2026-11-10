import prisma from "@/lib/prisma"
import { isCollected, netAmount, COLLECTED_PAYMENT_STATUSES } from "@/lib/revenue"

interface ReportParams {
  entityType: "enterprise" | "org"
  entityId: string
  dateFrom: Date
  dateTo: Date
}

export async function getRevenueReport(params: ReportParams) {
  const { entityType, entityId, dateFrom, dateTo } = params

  const eventFilter = entityType === "enterprise"
    ? { OR: [{ enterpriseId: entityId }, { organization: { enterpriseId: entityId } }] }
    : { organizationId: entityId }

  const payments = await prisma.payment.findMany({
    where: {
      event: eventFilter as any,
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: {
      id: true, amount: true, status: true, method: true, discountAmount: true,
      refundAmount: true, createdAt: true,
      event: { select: { id: true, title: true } },
      registration: { select: { ticketType: { select: { name: true } } } },
      coupon: { select: { code: true } },
    },
  })

  // Every payment that was paid, refunded ones included: gross = all of it, refunds = what
  // went back, and the breakdowns below show what was kept (net) so they add up to net.
  const completed = payments.filter((p) => isCollected(p.status))

  const totalRevenue = completed.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalRefunds = completed.reduce((sum, p) => sum + Number(p.refundAmount || 0), 0)
  const totalDiscount = completed.reduce((sum, p) => sum + Number(p.discountAmount || 0), 0)

  // By event
  const byEvent = Object.values(
    completed.reduce((acc, p) => {
      const key = p.event.id
      if (!acc[key]) acc[key] = { eventId: key, eventTitle: p.event.title, revenue: 0, transactions: 0 }
      acc[key].revenue += netAmount(p)
      acc[key].transactions++
      return acc
    }, {} as Record<string, { eventId: string; eventTitle: string; revenue: number; transactions: number }>)
  ).sort((a, b) => b.revenue - a.revenue)

  // By payment method
  const byMethod = Object.values(
    completed.reduce((acc, p) => {
      if (!acc[p.method]) acc[p.method] = { method: p.method, revenue: 0, count: 0 }
      acc[p.method].revenue += netAmount(p)
      acc[p.method].count++
      return acc
    }, {} as Record<string, { method: string; revenue: number; count: number }>)
  )

  // By ticket type
  const byTicketType = Object.values(
    completed.reduce((acc, p) => {
      const name = p.registration.ticketType.name
      if (!acc[name]) acc[name] = { ticketType: name, revenue: 0, count: 0 }
      acc[name].revenue += netAmount(p)
      acc[name].count++
      return acc
    }, {} as Record<string, { ticketType: string; revenue: number; count: number }>)
  )

  return {
    totalRevenue,
    totalRefunds,
    netRevenue: totalRevenue - totalRefunds,
    totalTransactions: completed.length,
    totalDiscount,
    platformFees: 0,
    byEvent,
    byMethod,
    byTicketType,
  }
}

export async function getDailyRevenue(params: ReportParams) {
  const { entityType, entityId, dateFrom, dateTo } = params

  const eventFilter = entityType === "enterprise"
    ? { OR: [{ enterpriseId: entityId }, { organization: { enterpriseId: entityId } }] }
    : { organizationId: entityId }

  const payments = await prisma.payment.findMany({
    where: {
      event: eventFilter as any,
      status: { in: [...COLLECTED_PAYMENT_STATUSES] },
      paidAt: { gte: dateFrom, lte: dateTo },
    },
    select: { amount: true, refundAmount: true, paidAt: true },
    orderBy: { paidAt: "asc" },
  })

  const dailyMap = new Map<string, number>()
  for (const p of payments) {
    if (!p.paidAt) continue
    const day = p.paidAt.toISOString().slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) || 0) + netAmount(p))
  }

  return Array.from(dailyMap.entries()).map(([date, revenue]) => ({ date, revenue }))
}
