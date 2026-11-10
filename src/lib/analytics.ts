import prisma from "@/lib/prisma"
import { COLLECTED_PAYMENT_STATUSES } from "@/lib/revenue"

export async function getEventFunnel(eventId: string) {
  const [registrations, confirmed, checkedIn, feedbacks] = await Promise.all([
    prisma.registration.count({ where: { eventId } }),
    prisma.registration.count({ where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
    prisma.checkIn.count({ where: { eventId } }),
    prisma.feedback.count({ where: { eventId } }),
  ])

  const views = 0 // Would come from page view tracking

  return {
    views,
    registrations,
    confirmed,
    paid: confirmed, // Simplified — all confirmed are considered paid for free events
    checkedIn,
    feedbackGiven: feedbacks,
    conversionRates: {
      viewToRegistration: views > 0 ? Math.round((registrations / views) * 100) : 0,
      registrationToConfirmed: registrations > 0 ? Math.round((confirmed / registrations) * 100) : 0,
      confirmedToCheckedIn: confirmed > 0 ? Math.round((checkedIn / confirmed) * 100) : 0,
      checkedInToFeedback: checkedIn > 0 ? Math.round((feedbacks / checkedIn) * 100) : 0,
    },
  }
}

export async function getEventAnalytics(eventId: string, dateFrom?: Date, dateTo?: Date) {
  const dateFilter = dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {}

  const [
    totalRegistrations, confirmedCount, checkedInCount, cancelledCount,
    pendingCount, waitlistedCount, feedbacks, payments, checkIns,
    registrationsByDate, ticketTypeStats,
  ] = await Promise.all([
    prisma.registration.count({ where: { eventId, ...dateFilter } }),
    prisma.registration.count({ where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, ...dateFilter } }),
    prisma.checkIn.count({ where: { eventId } }),
    prisma.registration.count({ where: { eventId, status: "CANCELLED", ...dateFilter } }),
    prisma.registration.count({ where: { eventId, status: "PENDING", ...dateFilter } }),
    prisma.registration.count({ where: { eventId, status: "WAITLISTED", ...dateFilter } }),
    prisma.feedback.findMany({
      where: { eventId },
      select: { rating: true, comment: true, isAnonymous: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { eventId, status: { in: [...COLLECTED_PAYMENT_STATUSES] } },
      select: { amount: true, createdAt: true, method: true, discountAmount: true, refundAmount: true },
    }),
    prisma.checkIn.findMany({
      where: { eventId },
      select: { checkedInAt: true, checkInMethod: true },
      orderBy: { checkedInAt: "asc" },
    }),
    prisma.registration.groupBy({
      by: ["createdAt"],
      where: { eventId },
      _count: true,
      orderBy: { createdAt: "asc" },
    }),
    prisma.registration.groupBy({
      by: ["ticketTypeId"],
      where: { eventId },
      _count: true,
    }),
  ])

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalRefunds = payments.reduce((sum, p) => sum + Number(p.refundAmount || 0), 0)
  const totalDiscount = payments.reduce((sum, p) => sum + Number(p.discountAmount || 0), 0)

  const allRatings = feedbacks.map((f) => f.rating)
  const avgRating = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0

  // Get ticket type names
  const ticketTypeIds = ticketTypeStats.map((t) => t.ticketTypeId)
  const ticketTypes = await prisma.ticketType.findMany({
    where: { id: { in: ticketTypeIds } },
    select: { id: true, name: true, price: true },
  })

  return {
    overview: {
      views: 0,
      uniqueViews: 0,
      registrations: totalRegistrations,
      confirmed: confirmedCount,
      revenue: totalRevenue - totalRefunds,
      checkIns: checkedInCount,
      attendanceRate: confirmedCount > 0 ? Math.round((checkedInCount / confirmedCount) * 100) : 0,
      avgRating: Math.round(avgRating * 10) / 10,
      feedbackCount: allRatings.length,
    },
    statusDistribution: {
      confirmed: confirmedCount,
      pending: pendingCount,
      waitlisted: waitlistedCount,
      cancelled: cancelledCount,
      checkedIn: checkedInCount,
      noShow: Math.max(0, confirmedCount - checkedInCount),
    },
    ticketDistribution: ticketTypeStats.map((ts) => {
      const tt = ticketTypes.find((t) => t.id === ts.ticketTypeId)
      return {
        ticketType: tt?.name || "Unknown",
        count: ts._count,
        revenue: ts._count * Number(tt?.price || 0),
      }
    }),
    revenueBreakdown: {
      gross: totalRevenue,
      coupons: totalDiscount,
      refunds: totalRefunds,
      platformFee: 0,
      net: totalRevenue - totalRefunds,
    },
    checkIn: {
      total: confirmedCount,
      checked: checkedInCount,
      percentage: confirmedCount > 0 ? Math.round((checkedInCount / confirmedCount) * 100) : 0,
      byMethod: Object.entries(
        checkIns.reduce((acc, ci) => {
          acc[ci.checkInMethod] = (acc[ci.checkInMethod] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      ).map(([method, count]) => ({ method, count })),
    },
    feedback: {
      avgRating: Math.round(avgRating * 10) / 10,
      count: allRatings.length,
      distribution: {
        5: allRatings.filter((r) => r === 5).length,
        4: allRatings.filter((r) => r === 4).length,
        3: allRatings.filter((r) => r === 3).length,
        2: allRatings.filter((r) => r === 2).length,
        1: allRatings.filter((r) => r === 1).length,
      },
      recentComments: feedbacks.map((f) => ({
        rating: f.rating,
        comment: f.comment,
        name: f.isAnonymous ? "Anonymous" : f.user.name,
        date: f.createdAt.toISOString(),
      })),
    },
  }
}

export async function getOrgAnalytics(orgId: string, dateFrom: Date, dateTo: Date) {
  const eventFilter = { organizationId: orgId, deletedAt: null }
  const dateFilter = { createdAt: { gte: dateFrom, lte: dateTo } }

  const [totalEvents, totalRegistrations, totalRevenue, totalCheckIns, feedbacks, events] = await Promise.all([
    prisma.event.count({ where: { ...eventFilter, ...dateFilter } }),
    prisma.registration.count({ where: { event: eventFilter, ...dateFilter } }),
    prisma.payment.aggregate({
      where: { event: eventFilter, status: { in: [...COLLECTED_PAYMENT_STATUSES] }, ...dateFilter },
      _sum: { amount: true, refundAmount: true },
    }),
    prisma.checkIn.count({ where: { event: eventFilter, ...dateFilter } }),
    prisma.feedback.aggregate({ where: { event: eventFilter }, _avg: { rating: true }, _count: true }),
    prisma.event.findMany({
      where: { ...eventFilter, ...dateFilter },
      select: {
        id: true, title: true, startDate: true, maxCapacity: true, currentRegistrations: true, status: true, category: true,
        // registrations = the ones that can attend (same base as the event analytics attendanceRate)
        _count: { select: { registrations: { where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } }, checkIns: true, feedbacks: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ])

  const confirmedRegs = await prisma.registration.count({
    where: { event: eventFilter, status: { in: ["CONFIRMED", "CHECKED_IN"] }, ...dateFilter },
  })

  const attendanceRate = confirmedRegs > 0 ? Math.round((totalCheckIns / confirmedRegs) * 100) : 0

  // Per-event revenue (same COMPLETED + date window as the overview total) for the performance table.
  const revenueByEvent = new Map<string, number>()
  if (events.length > 0) {
    const sums = await prisma.payment.groupBy({
      by: ["eventId"],
      where: { eventId: { in: events.map((e) => e.id) }, status: { in: [...COLLECTED_PAYMENT_STATUSES] }, ...dateFilter },
      _sum: { amount: true, refundAmount: true },
    })
    for (const row of sums) if (row.eventId) revenueByEvent.set(row.eventId, Number(row._sum.amount || 0) - Number(row._sum.refundAmount || 0))
  }

  const categories = new Map<string, { category: string; events: number; registrations: number }>()
  for (const e of events) {
    const key = e.category || "Other"
    const c = categories.get(key) ?? { category: key, events: 0, registrations: 0 }
    c.events += 1
    c.registrations += e.currentRegistrations
    categories.set(key, c)
  }
  const categoryBreakdown = [...categories.values()].sort((a, b) => b.registrations - a.registrations)

  const eventPerformance = events.map((e) => {
    const capacityPct = e.maxCapacity ? Math.round((e.currentRegistrations / e.maxCapacity) * 100) : 0
    const attendance = e._count.registrations > 0 ? Math.round((e._count.checkIns / e._count.registrations) * 100) : 0
    const score = Math.round((capacityPct * 0.3 + attendance * 0.3 + (feedbacks._avg?.rating || 0) * 20 * 0.2) + 20)

    return {
      eventId: e.id,
      title: e.title,
      date: e.startDate.toISOString(),
      registrations: e.currentRegistrations,
      capacity: e.maxCapacity,
      capacityPct,
      attendance,
      rating: feedbacks._avg?.rating || 0,
      score: Math.min(100, score),
      checkIns: e._count.checkIns,
      revenue: revenueByEvent.get(e.id) ?? 0,
      status: e.status,
    }
  })

  return {
    overview: {
      totalEvents,
      totalRegistrations,
      // money kept: collected minus refunds
      totalRevenue: Number(totalRevenue._sum?.amount || 0) - Number(totalRevenue._sum?.refundAmount || 0),
      attendanceRate,
      avgRating: Math.round((feedbacks._avg?.rating || 0) * 10) / 10,
      feedbackCount: feedbacks._count,
    },
    eventPerformance,
    categoryBreakdown,
  }
}

export function generateCSVReport(data: Record<string, unknown>[], headers: string[]): string {
  const BOM = "\uFEFF"
  const headerRow = headers.join(",")
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = String(row[h] ?? "")
      return `"${val.replace(/"/g, '""')}"`
    }).join(",")
  )
  return BOM + headerRow + "\n" + rows.join("\n")
}
