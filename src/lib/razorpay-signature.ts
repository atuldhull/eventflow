import crypto from "crypto"

// Razorpay signs with HMAC-SHA256 and sends the digest as lowercase hex (64 chars).
const HEX_SHA256 = /^[0-9a-f]{64}$/i

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

// Constant-time comparison of a provided hex signature against the expected digest.
// Anything that isn't a well-formed 64-char hex string is rejected up front, so a
// valid digest with trailing junk can't slip through Buffer.from's lenient hex parsing.
export function signatureMatches(expectedHex: string, provided: unknown): boolean {
  if (typeof provided !== "string" || !HEX_SHA256.test(provided)) return false
  const expected = Buffer.from(expectedHex, "hex")
  const actual = Buffer.from(provided, "hex")
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

// Checkout success signature: HMAC-SHA256(`${order_id}|${payment_id}`, RAZORPAY_KEY_SECRET).
// Fails closed when the secret or any field is missing.
export function verifyPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: unknown
  secret: string | undefined
}): boolean {
  const { orderId, paymentId, signature, secret } = params
  if (!secret || !orderId || !paymentId) return false
  return signatureMatches(hmacSha256Hex(secret, `${orderId}|${paymentId}`), signature)
}

// Webhook signature: HMAC-SHA256(raw request body, RAZORPAY_WEBHOOK_SECRET), sent in the
// `x-razorpay-signature` header. The body must be the exact bytes received, not re-serialized JSON.
export function verifyWebhookSignature(params: {
  rawBody: string
  signature: unknown
  secret: string | undefined
}): boolean {
  const { rawBody, signature, secret } = params
  if (!secret) return false
  return signatureMatches(hmacSha256Hex(secret, rawBody), signature)
}
