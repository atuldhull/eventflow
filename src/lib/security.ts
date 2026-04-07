import DOMPurify from "isomorphic-dompurify"
import crypto from "crypto"

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[<>&"']/g, (char) => {
      const entities: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#x27;" }
      return entities[char] || char
    })
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "h2", "h3", "ul", "ol", "li", "a", "img", "blockquote", "code", "pre", "span", "div"],
    ALLOWED_ATTR: ["href", "src", "alt", "class", "target", "rel"],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "textarea", "select", "button"],
    FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "onfocus", "onblur", "style"],
  })
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length)
}

export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export function verifyHMAC(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
