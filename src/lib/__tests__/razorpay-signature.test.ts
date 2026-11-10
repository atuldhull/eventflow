import crypto from "crypto"
import { describe, it, expect } from "vitest"
import {
  hmacSha256Hex,
  signatureMatches,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "@/lib/razorpay-signature"

const KEY_SECRET = "test_key_secret"
const WEBHOOK_SECRET = "test_webhook_secret"
const ORDER_ID = "order_Nx1"
const PAYMENT_ID = "pay_Nx1"

// Independent reference implementation, so the tests don't just re-run the helper.
const sign = (secret: string, payload: string) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex")

describe("hmacSha256Hex", () => {
  it("matches Node's HMAC-SHA256 hex digest", () => {
    expect(hmacSha256Hex(KEY_SECRET, "abc")).toBe(sign(KEY_SECRET, "abc"))
  })
})

describe("verifyPaymentSignature", () => {
  const valid = sign(KEY_SECRET, `${ORDER_ID}|${PAYMENT_ID}`)

  it("accepts the signature Razorpay produces for order_id|payment_id", () => {
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: valid, secret: KEY_SECRET })).toBe(true)
  })

  it("rejects a signature made with a different secret", () => {
    const forged = sign("attacker_secret", `${ORDER_ID}|${PAYMENT_ID}`)
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: forged, secret: KEY_SECRET })).toBe(false)
  })

  it("rejects a valid signature replayed against a different order or payment", () => {
    expect(verifyPaymentSignature({ orderId: "order_other", paymentId: PAYMENT_ID, signature: valid, secret: KEY_SECRET })).toBe(false)
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: "pay_other", signature: valid, secret: KEY_SECRET })).toBe(false)
  })

  it("rejects a tampered signature (one hex digit flipped)", () => {
    const tampered = (valid[0] === "a" ? "b" : "a") + valid.slice(1)
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: tampered, secret: KEY_SECRET })).toBe(false)
  })

  it("rejects malformed signatures, including a valid digest with trailing junk", () => {
    for (const signature of ["", "not-hex", valid.slice(0, 62), `${valid}zz`, `${valid}00`, null, undefined, 123, { valid }]) {
      expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature, secret: KEY_SECRET })).toBe(false)
    }
  })

  it("fails closed when the secret is missing", () => {
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: valid, secret: undefined })).toBe(false)
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: PAYMENT_ID, signature: sign("", `${ORDER_ID}|${PAYMENT_ID}`), secret: "" })).toBe(false)
  })

  it("fails closed when the order or payment id is missing", () => {
    expect(verifyPaymentSignature({ orderId: "", paymentId: PAYMENT_ID, signature: sign(KEY_SECRET, `|${PAYMENT_ID}`), secret: KEY_SECRET })).toBe(false)
    expect(verifyPaymentSignature({ orderId: ORDER_ID, paymentId: "", signature: sign(KEY_SECRET, `${ORDER_ID}|`), secret: KEY_SECRET })).toBe(false)
  })
})

describe("verifyWebhookSignature", () => {
  const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: PAYMENT_ID, order_id: ORDER_ID, amount: 50000 } } } })
  const valid = sign(WEBHOOK_SECRET, rawBody)

  it("accepts HMAC-SHA256 of the raw body", () => {
    expect(verifyWebhookSignature({ rawBody, signature: valid, secret: WEBHOOK_SECRET })).toBe(true)
  })

  it("accepts an upper-case hex signature", () => {
    expect(verifyWebhookSignature({ rawBody, signature: valid.toUpperCase(), secret: WEBHOOK_SECRET })).toBe(true)
  })

  it("rejects a tampered body", () => {
    const tamperedBody = rawBody.replace("50000", "1")
    expect(verifyWebhookSignature({ rawBody: tamperedBody, signature: valid, secret: WEBHOOK_SECRET })).toBe(false)
  })

  it("rejects a body that was re-serialized (whitespace differs)", () => {
    const reserialized = JSON.stringify(JSON.parse(rawBody), null, 2)
    expect(verifyWebhookSignature({ rawBody: reserialized, signature: valid, secret: WEBHOOK_SECRET })).toBe(false)
  })

  it("rejects a signature made with the key secret instead of the webhook secret", () => {
    expect(verifyWebhookSignature({ rawBody, signature: sign(KEY_SECRET, rawBody), secret: WEBHOOK_SECRET })).toBe(false)
  })

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature({ rawBody, signature: null, secret: WEBHOOK_SECRET })).toBe(false)
  })

  it("fails closed when the webhook secret is missing", () => {
    expect(verifyWebhookSignature({ rawBody, signature: valid, secret: undefined })).toBe(false)
    expect(verifyWebhookSignature({ rawBody, signature: sign("", rawBody), secret: "" })).toBe(false)
  })
})

describe("signatureMatches", () => {
  it("compares in constant time only when lengths match", () => {
    const digest = sign(KEY_SECRET, "x")
    expect(signatureMatches(digest, digest)).toBe(true)
    expect(signatureMatches(digest, sign(KEY_SECRET, "y"))).toBe(false)
  })
})
