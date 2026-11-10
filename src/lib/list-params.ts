import { z } from "zod/v4"

/**
 * Query-string parsing for paginated admin lists: page and limit are clamped to sane
 * bounds (a bad or huge value can't ask the database for everything), and the search
 * term is trimmed, length-capped, and dropped when empty.
 */
export function parseListParams(
  searchParams: URLSearchParams,
  { defaultLimit = 20, maxLimit = 100 }: { defaultLimit?: number; maxLimit?: number } = {}
) {
  const int = (raw: string | null, fallback: number, min: number, max: number) => {
    const n = Number.parseInt(raw ?? "", 10)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  }
  const page = int(searchParams.get("page"), 1, 1, 10_000)
  const limit = int(searchParams.get("limit"), defaultLimit, 1, maxLimit)
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100)
  return { page, limit, skip: (page - 1) * limit, search: search || undefined }
}

/** An optional enum filter from the query string: a value outside `values` reads as no filter. */
export function parseEnumParam<const T extends readonly [string, ...string[]]>(
  searchParams: URLSearchParams,
  name: string,
  values: T
): T[number] | undefined {
  const parsed = z.enum(values).safeParse(searchParams.get(name))
  return parsed.success ? parsed.data : undefined
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) }
}
