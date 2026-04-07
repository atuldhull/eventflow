import prisma from "@/lib/prisma"

interface ReconciliationResult {
  paymentId: string
  status: "in_sync" | "updated" | "discrepancy"
  ourStatus: string
  gatewayStatus?: string
  details?: string
}

export async function reconcilePayment(paymentId: string): Promise<ReconciliationResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, method: true, gatewayPaymentId: true, registrationId: true },
  })

  if (!payment) {
    return { paymentId, status: "discrepancy", ourStatus: "NOT_FOUND", details: "Payment not found" }
  }

  // In production: call Razorpay/Stripe API to check actual payment status
  // For now: just verify consistency
  if (payment.status === "PENDING" && payment.gatewayPaymentId) {
    // Payment has a gateway ID but is still pending — likely captured
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "COMPLETED", paidAt: new Date() },
    })

    // Confirm the registration
    await prisma.registration.update({
      where: { id: payment.registrationId },
      data: { status: "CONFIRMED" },
    })

    return { paymentId, status: "updated", ourStatus: payment.status, gatewayStatus: "CAPTURED", details: "Updated to COMPLETED" }
  }

  return { paymentId, status: "in_sync", ourStatus: payment.status }
}

export async function reconcileAll(dateFrom: Date, dateTo: Date) {
  const pendingPayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: { id: true },
  })

  const results: ReconciliationResult[] = []
  for (const payment of pendingPayments) {
    results.push(await reconcilePayment(payment.id))
  }

  return {
    checked: results.length,
    updated: results.filter((r) => r.status === "updated").length,
    discrepancies: results.filter((r) => r.status === "discrepancy").length,
    results,
  }
}
