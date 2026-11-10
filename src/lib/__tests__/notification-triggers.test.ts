import { describe, it, expect, beforeEach, vi } from "vitest"

// In-app notifications for payment and certificate events, written once each.
const mocks = vi.hoisted(() => {
  const tx = {
    payment: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    registration: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    event: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    ticketType: { findUnique: vi.fn(), updateMany: vi.fn() },
    coupon: { updateMany: vi.fn() },
  }
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      ticket: { findFirst: vi.fn() },
      registration: { findUnique: vi.fn() },
      payment: { findUnique: vi.fn() },
      notification: { create: vi.fn() },
      certificate: { findFirst: vi.fn(), create: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    },
    generateTicket: vi.fn(),
    sendEmail: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))
vi.mock("@/lib/ticket", () => ({ generateTicket: mocks.generateTicket }))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))

import { completeRegistrationPayment } from "@/lib/payment-completion"
import { generateCertificate, revokeCertificate } from "@/lib/certificate"

const notified = (category: string) =>
  mocks.prisma.notification.create.mock.calls.filter(([arg]) => arg.data.category === category).map(([arg]) => arg.data)

beforeEach(() => {
  vi.resetAllMocks()
  mocks.prisma.$transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx))
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue({ registrationId: "reg_1", couponId: null })
  mocks.tx.registration.findUniqueOrThrow.mockResolvedValue({
    id: "reg_1", status: "PENDING", eventId: "evt_1", ticketTypeId: "tt_1",
    metadata: { ticketQuantity: 1, holdExpiresAt: new Date(Date.now() + 600_000).toISOString() },
  })
  mocks.prisma.registration.findUnique.mockResolvedValue({ status: "CONFIRMED" })
  mocks.prisma.ticket.findFirst.mockResolvedValue(null)
  mocks.prisma.payment.findUnique.mockResolvedValue({ userId: "user_1", eventId: "evt_1", amount: 499, event: { title: "Demo Day" } })
})

describe("payment completion", () => {
  it("tells the buyer once, from the call that completed the payment", async () => {
    mocks.tx.payment.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })
    await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" }) // webhook after verify

    const payments = notified("PAYMENT")
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ userId: "user_1", eventId: "evt_1" })
    expect(payments[0].message).toContain("Demo Day")
  })

  it("emails the buyer a receipt once, with the amount and a ticket link", async () => {
    mocks.tx.payment.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    mocks.prisma.payment.findUnique.mockResolvedValue({
      userId: "user_1", eventId: "evt_1", amount: 499, currency: "INR", paymentNumber: "PAY-1",
      event: { title: "Demo <Day>" }, user: { email: "buyer@example.com", name: "B" },
      registration: { registrationNumber: "EVT-2026-00001", ticket: { ticketNumber: "TKT-ABC" } },
    })

    await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })
    await completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" }) // webhook after verify

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    const mail = mocks.sendEmail.mock.calls[0][0]
    expect(mail.to).toBe("buyer@example.com")
    expect(mail.subject).toMatch(/^Payment received/)
    expect(mail.html).toContain("499")
    expect(mail.html).toContain("TKT-ABC")
    expect(mail.html).toContain("Demo &lt;Day&gt;")
    expect(mail.html).not.toContain("Demo <Day>")
  })

  it("a failing receipt email never fails the payment", async () => {
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
    mocks.sendEmail.mockRejectedValue(new Error("smtp down"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })).resolves.toMatchObject({ completed: true })
  })

  it("a failing notification never fails the payment", async () => {
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.notification.create.mockRejectedValue(new Error("db down"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(completeRegistrationPayment("pmt_1", { gatewayPaymentId: "pay_1" })).resolves.toMatchObject({ completed: true })
  })
})

describe("certificates", () => {
  beforeEach(() => {
    mocks.prisma.registration.findUnique.mockResolvedValue({
      id: "reg_1",
      user: { id: "user_1", name: "Asha", email: "a@example.com" },
      event: { id: "evt_1", title: "Demo Day", startDate: new Date(), organization: { name: "Club" } },
    })
  })

  it("a newly issued certificate notifies its recipient; an existing one doesn't again", async () => {
    mocks.prisma.certificate.findFirst.mockResolvedValueOnce(null)
    mocks.prisma.certificate.create.mockResolvedValue({ id: "c1", userId: "user_1", eventId: "evt_1" })
    await generateCertificate({ registrationId: "reg_1", templateId: "tpl_1", type: "PARTICIPATION" })

    mocks.prisma.certificate.findFirst.mockResolvedValueOnce({ id: "c1" })
    await generateCertificate({ registrationId: "reg_1", templateId: "tpl_1", type: "PARTICIPATION" })

    expect(notified("CERTIFICATE")).toHaveLength(1)
    expect(notified("CERTIFICATE")[0]).toMatchObject({ userId: "user_1", title: "Certificate Available" })
  })

  it("revoking a valid certificate notifies its recipient", async () => {
    mocks.prisma.certificate.findUniqueOrThrow.mockResolvedValue({
      metadata: null, status: "GENERATED", userId: "user_1", eventId: "evt_1", event: { title: "Demo Day" },
    })
    mocks.prisma.certificate.update.mockResolvedValue({})

    await revokeCertificate("c1", { revokedBy: "admin_1" })

    expect(notified("CERTIFICATE")).toEqual([expect.objectContaining({ userId: "user_1", title: "Certificate Revoked" })])
  })
})
