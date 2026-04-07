import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateInvoiceData, generateInvoiceHTML } from "@/lib/invoice"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { paymentId } = await params

  // Check access: user is payer or has admin access
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  })

  if (!payment) {
    return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 })
  }

  if (payment.userId !== session.user.id) {
    // Could add admin permission check here
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 })
  }

  const invoiceData = await generateInvoiceData(paymentId)
  if (!invoiceData) {
    return NextResponse.json({ success: false, message: "Unable to generate invoice" }, { status: 500 })
  }

  const html = generateInvoiceHTML(invoiceData)

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="invoice-${invoiceData.invoiceNumber}.html"`,
    },
  })
}
