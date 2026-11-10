// Runs once when the server starts (Next.js instrumentation hook).
export async function register() {
  // Only the Node.js server: the edge runtime (middleware) has no file system or secrets to check.
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  // `next build` also loads this file; the settings are checked when the server runs.
  if (process.env.NEXT_PHASE === "phase-production-build") return
  const { enforceEnv } = await import("@/lib/env-check")
  enforceEnv()
}

// Every unhandled error in a route handler, server component or server action ends up here.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { reportError } = await import("@/lib/error-reporting")
  await reportError(error, {
    where: `${request.method} ${context.routePath || request.path}`,
    extra: { routeType: context.routeType, routerKind: context.routerKind, digest: (error as { digest?: string })?.digest },
  })
}
