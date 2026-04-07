import { NextResponse } from "next/server"

export class ApiError extends Error {
  statusCode: number
  code: string
  details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static badRequest(message: string, details?: unknown) { return new ApiError(400, "bad_request", message, details) }
  static unauthorized(message = "Authentication required") { return new ApiError(401, "unauthorized", message) }
  static forbidden(message = "Access denied") { return new ApiError(403, "forbidden", message) }
  static notFound(entity = "Resource") { return new ApiError(404, "not_found", `${entity} not found`) }
  static conflict(message: string) { return new ApiError(409, "conflict", message) }
  static rateLimited() { return new ApiError(429, "rate_limited", "Too many requests. Try again later.") }
  static internal(message = "Internal server error") { return new ApiError(500, "internal_error", message) }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.statusCode }
    )
  }

  // Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; meta?: { target?: string[] } }
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: { code: "conflict", message: "A record with this value already exists" } },
        { status: 409 }
      )
    }
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: { code: "not_found", message: "Record not found" } },
        { status: 404 }
      )
    }
  }

  // Log unexpected errors
  console.error("Unhandled API error:", error)

  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong" } },
    { status: 500 }
  )
}

export function withErrorHandler(handler: Function) {
  return async (...args: unknown[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
