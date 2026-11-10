/**
 * Post-sign-in destinations. Pure functions with no server imports, so the client
 * hooks, the auth pages and the middleware all share one definition.
 */

const PLACEHOLDER_ORIGIN = "http://callback.invalid"

/**
 * A `callbackUrl` from the query string may only send the browser to a path on this
 * site. Returns the normalised path (with its query and hash), or null for anything a
 * browser could resolve to another origin: absolute URLs, protocol-relative "//host",
 * "/\host" (browsers read the backslash as a slash), and control characters, which URL
 * parsing strips ("/\t/evil.example" becomes "//evil.example").
 */
export function getSafeCallbackUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN)
    if (url.origin !== PLACEHOLDER_ORIGIN) return null
    // Dot segments can normalise into a protocol-relative path: "/.//evil.example" → "//evil.example"
    if (url.pathname.startsWith("//")) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** The home page for a global role. */
export function getRoleRedirectPath(role: string | null | undefined): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin"
    case "ENTERPRISE_ADMIN":
    case "ENTERPRISE_MANAGER":
    case "ORG_ADMIN":
    case "EVENT_MANAGER":
    case "COORDINATOR":
    case "FINANCE_MANAGER":
    case "VIEWER":
      return "/admin"
    default:
      return "/dashboard"
  }
}

/** Where to go after signing in: a safe callbackUrl if one was given, else the role's home. */
export function getPostLoginPath(callbackUrl: string | null | undefined, role: string | null | undefined): string {
  return getSafeCallbackUrl(callbackUrl) ?? getRoleRedirectPath(role)
}
