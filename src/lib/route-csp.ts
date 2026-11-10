/**
 * Responses that send their own, stricter Content-Security-Policy: uploaded files (a
 * sandboxing CSP, src/app/uploads/[...path]/route.ts) and the certificate download (a PDF,
 * or with ?format=html the printable page with no scripts at all,
 * src/app/api/certificates/[certificateId]/download/route.ts).
 * Headers the middleware sets override the route's, so it leaves its global policy off
 * these paths and the route's own policy is what the browser gets.
 */
export function routeSetsOwnCsp(pathname: string): boolean {
  return pathname.startsWith("/uploads/") || /^\/api\/certificates\/[^/]+\/download\/?$/.test(pathname)
}
