import prisma from "@/lib/prisma"
import { calculateTax, formatINR } from "@/lib/tax"

interface InvoiceData {
  invoiceNumber: string
  invoiceDate: Date
  paymentDate: Date | null
  participant: { name: string; email: string; phone?: string | null }
  organization: { name: string; email: string; address?: string | null }
  event: { title: string; startDate: Date; registrationNumber: string }
  lineItems: { description: string; quantity: number; rate: number; amount: number }[]
  subtotal: number
  discount: number
  couponCode?: string | null
  tax: { cgst: number; sgst: number; igst: number; total: number; type: string }
  platformFee: number
  total: number
  paymentMethod: string
  transactionId?: string | null
  status: string
}

export async function generateInvoiceData(paymentId: string): Promise<InvoiceData | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { name: true, email: true, phone: true, state: true } },
      event: {
        select: {
          title: true,
          startDate: true,
          organization: { select: { name: true, email: true, address: true, state: true } },
        },
      },
      registration: { select: { registrationNumber: true, ticketType: { select: { name: true, price: true, currency: true } } } },
      coupon: { select: { code: true } },
    },
  })

  if (!payment) return null

  const ticketPrice = Number(payment.registration.ticketType.price)
  const quantity = 1
  const subtotal = ticketPrice * quantity
  const discount = Number(payment.discountAmount || 0)
  const taxableAmount = subtotal - discount

  const taxResult = calculateTax({
    amount: taxableAmount,
    sellerState: payment.event.organization?.state || undefined,
    buyerState: payment.user.state || undefined,
    gstEnabled: Number(payment.amount) > 0, // Enable GST for paid events
  })

  const year = new Date().getFullYear()
  const invoiceNumber = `INV-${year}-${payment.paymentNumber.replace("PAY-", "")}`

  return {
    invoiceNumber,
    invoiceDate: new Date(),
    paymentDate: payment.paidAt,
    participant: {
      name: payment.user.name,
      email: payment.user.email,
      phone: payment.user.phone,
    },
    organization: {
      name: payment.event.organization?.name || "EventFlow",
      email: payment.event.organization?.email || "",
      address: payment.event.organization?.address,
    },
    event: {
      title: payment.event.title,
      startDate: payment.event.startDate,
      registrationNumber: payment.registration.registrationNumber,
    },
    lineItems: [{
      description: payment.registration.ticketType.name,
      quantity,
      rate: ticketPrice,
      amount: subtotal,
    }],
    subtotal,
    discount,
    couponCode: payment.coupon?.code,
    tax: {
      cgst: taxResult.cgst,
      sgst: taxResult.sgst,
      igst: taxResult.igst,
      total: taxResult.totalTax,
      type: taxResult.taxType,
    },
    platformFee: 0,
    total: Number(payment.amount),
    paymentMethod: payment.method,
    transactionId: payment.gatewayPaymentId,
    status: payment.status,
  }
}

export function generateInvoiceHTML(data: InvoiceData): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Invoice ${data.invoiceNumber}</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; font-size: 13px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .title { font-size: 28px; font-weight: bold; color: #09090b; }
  .meta { text-align: right; color: #666; }
  .meta p { margin: 2px 0; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .party { width: 45%; }
  .party h4 { color: #666; font-size: 11px; text-transform: uppercase; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f4f4f5; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; }
  td { padding: 10px; border-bottom: 1px solid #e5e5e5; }
  .totals { margin-left: auto; width: 300px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .total { font-weight: bold; font-size: 16px; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 8px; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-paid { background: #dcfce7; color: #166534; }
</style></head>
<body>
  <div class="header">
    <div><div class="title">EventFlow</div><p style="color:#666;margin-top:4px;">Event Management Platform</p></div>
    <div class="meta">
      <p style="font-size:20px;font-weight:bold;">INVOICE</p>
      <p>${data.invoiceNumber}</p>
      <p>Date: ${data.invoiceDate.toLocaleDateString("en-IN")}</p>
      ${data.paymentDate ? `<p>Paid: ${data.paymentDate.toLocaleDateString("en-IN")}</p>` : ""}
    </div>
  </div>
  <div class="parties">
    <div class="party"><h4>Bill To</h4><p><strong>${data.participant.name}</strong></p><p>${data.participant.email}</p>${data.participant.phone ? `<p>${data.participant.phone}</p>` : ""}</div>
    <div class="party"><h4>Bill From</h4><p><strong>${data.organization.name}</strong></p><p>${data.organization.email}</p>${data.organization.address ? `<p>${data.organization.address}</p>` : ""}</div>
  </div>
  <div style="background:#f9fafb;padding:12px;border-radius:6px;margin-bottom:20px;">
    <p style="margin:0;"><strong>Event:</strong> ${data.event.title}</p>
    <p style="margin:4px 0 0;color:#666;">Registration #: ${data.event.registrationNumber} | Date: ${data.event.startDate.toLocaleDateString("en-IN")}</p>
  </div>
  <table>
    <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${data.lineItems.map((item, i) => `<tr><td>${i + 1}</td><td>${item.description}</td><td>${item.quantity}</td><td>${formatINR(item.rate)}</td><td style="text-align:right;">${formatINR(item.amount)}</td></tr>`).join("")}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatINR(data.subtotal)}</span></div>
    ${data.discount > 0 ? `<div class="row" style="color:#16a34a;"><span>Discount${data.couponCode ? ` (${data.couponCode})` : ""}</span><span>-${formatINR(data.discount)}</span></div>` : ""}
    ${data.tax.total > 0 ? `
      ${data.tax.cgst > 0 ? `<div class="row"><span>CGST @9%</span><span>${formatINR(data.tax.cgst)}</span></div><div class="row"><span>SGST @9%</span><span>${formatINR(data.tax.sgst)}</span></div>` : ""}
      ${data.tax.igst > 0 ? `<div class="row"><span>IGST @18%</span><span>${formatINR(data.tax.igst)}</span></div>` : ""}
    ` : ""}
    <div class="row total"><span>Total</span><span>${formatINR(data.total)}</span></div>
  </div>
  <div style="margin-top:30px;padding:12px;background:#f9fafb;border-radius:6px;">
    <p style="margin:0;"><strong>Payment:</strong> ${data.paymentMethod} ${data.transactionId ? `| Ref: ${data.transactionId}` : ""} | <span class="badge badge-paid">${data.status}</span></p>
  </div>
  <div class="footer"><p>This is a computer-generated invoice. Thank you for your registration.</p></div>
</body></html>`
}
