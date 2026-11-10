// Browser-only helpers for Razorpay Checkout. Import from client components.

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

export type RazorpaySuccessResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string }
  notes?: Record<string, string>
  handler: (response: RazorpaySuccessResponse) => void
  modal?: { ondismiss?: () => void }
}

type RazorpayInstance = { open: () => void }

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

export class CheckoutDismissedError extends Error {}

let loader: Promise<boolean> | null = null

export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (!loader) {
    loader = new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = CHECKOUT_SRC
      script.async = true
      script.onload = () => resolve(!!window.Razorpay)
      script.onerror = () => {
        loader = null
        resolve(false)
      }
      document.body.appendChild(script)
    })
  }
  return loader
}

// Opens Checkout for a server-created order. Resolves with the signed success payload
// (to be sent to a server verify endpoint); rejects with CheckoutDismissedError if the
// buyer closes the window. Failed attempts stay inside Checkout so the buyer can retry.
export async function openRazorpayCheckout(
  options: Omit<RazorpayCheckoutOptions, "handler" | "modal">
): Promise<RazorpaySuccessResponse> {
  const loaded = await loadRazorpayCheckout()
  const Razorpay = typeof window !== "undefined" ? window.Razorpay : undefined
  if (!loaded || !Razorpay) {
    throw new Error("Could not load the payment window. Check your connection and try again.")
  }
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      ...options,
      handler: resolve,
      modal: { ondismiss: () => reject(new CheckoutDismissedError("Payment cancelled")) },
    })
    checkout.open()
  })
}

// Plan change for an org or enterprise: free plans switch immediately; paid plans
// open Checkout for the server-created order and are activated only by /verify.
export async function purchasePlan(params: {
  plan: string
  billingInterval: "MONTHLY" | "YEARLY"
  entityType: "enterprise" | "org"
  entityId: string
  prefill?: { name?: string; email?: string }
}): Promise<{ success: boolean; message: string; cancelled?: boolean }> {
  const { plan, billingInterval, entityType, entityId, prefill } = params

  const res = await fetch("/api/admin/billing/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, billingInterval, entityType, entityId }),
  })
  const data = await res.json()
  if (!data.success) return { success: false, message: data.message || "Failed to change plan" }
  if (!data.data?.requiresPayment) return { success: true, message: "Plan updated!" }

  const order = data.data as { orderId: string; amount: number; currency: string; keyId: string }
  let payment: RazorpaySuccessResponse
  try {
    payment = await openRazorpayCheckout({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "EventFlow",
      description: `${plan.charAt(0)}${plan.slice(1).toLowerCase()} plan (${billingInterval.toLowerCase()})`,
      prefill,
    })
  } catch (err) {
    if (err instanceof CheckoutDismissedError) return { success: false, cancelled: true, message: err.message }
    return { success: false, message: err instanceof Error ? err.message : "Payment failed" }
  }

  const verifyRes = await fetch("/api/admin/billing/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payment, plan, billingInterval, entityType, entityId }),
  })
  const verified = await verifyRes.json()
  return verified.success
    ? { success: true, message: "Payment successful — plan activated!" }
    : { success: false, message: verified.message || "Payment verification failed" }
}
