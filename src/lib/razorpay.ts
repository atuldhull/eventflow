// Server-side Razorpay client. Lazy so a missing key doesn't crash module load;
// callers check isRazorpayConfigured() first and answer 503 when it's false.

export type RazorpayOrder = {
  id: string
  amount: number
  currency: string
  status?: string
  receipt?: string | null
  // Razorpay returns [] rather than {} when an order has no notes.
  notes?: Record<string, string> | unknown[]
}

type RazorpayClient = {
  orders: {
    create: (opts: Record<string, unknown>) => Promise<RazorpayOrder>
    fetch: (orderId: string) => Promise<RazorpayOrder>
  }
  payments: {
    // amount in paise; omitted = full refund
    refund: (paymentId: string, opts: { amount?: number; notes?: Record<string, string> }) => Promise<{ id: string; amount?: number; status?: string }>
  }
}

let _razorpay: RazorpayClient | null = null

export function isRazorpayConfigured(): boolean {
  return !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET
}

export function getRazorpay(): RazorpayClient {
  if (!isRazorpayConfigured()) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set")
  }
  if (!_razorpay) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require("razorpay")
    _razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) as RazorpayClient
  }
  return _razorpay
}

export function getOrderNotes(order: RazorpayOrder): Record<string, string> {
  return order.notes && !Array.isArray(order.notes) ? order.notes : {}
}
