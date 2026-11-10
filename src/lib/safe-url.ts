/**
 * A media URL that may be put into src/href on a public page: an http(s) link, or a path
 * to our own uploads ("/uploads/..."). Never javascript:, data:, vbscript: or other schemes.
 */
export function isSafeMediaUrl(value: unknown): boolean {
  if (typeof value !== "string") return false
  const v = value.trim()
  if (!v || v.length > 2000 || /[\s<>"'`]/.test(v)) return false
  if (v.startsWith("/uploads/")) return !v.includes("..") && !v.includes("//", 1)
  try {
    const u = new URL(v)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}
