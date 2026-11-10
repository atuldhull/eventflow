"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface DataTablePaginationProps {
  page: number
  pageSize: number
  total: number
  onPaginationChange: (page: number, pageSize: number) => void
}

/** Quiet pagination under a table: the range in 13px grey, four icon buttons. */
export function DataTablePagination({
  page,
  pageSize,
  total,
  onPaginationChange,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const fmt = (n: number) => n.toLocaleString("en-IN")

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground tabular-nums">
      <p className="min-w-0 truncate">
        <span className="max-sm:hidden">Showing </span>
        {fmt(total > 0 ? start : 0)}–{fmt(end)} of {fmt(total)}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="First page"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onPaginationChange(1, pageSize)}
          disabled={page <= 1}
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous page"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onPaginationChange(page - 1, pageSize)}
          disabled={page <= 1}
        >
          <ChevronLeft />
        </Button>
        <span className="px-1.5 whitespace-nowrap" aria-live="polite">
          <span className="max-sm:hidden">Page </span>
          {page}
          <span className="max-sm:hidden"> of </span>
          <span className="sm:hidden"> / </span>
          {totalPages || 1}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next page"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onPaginationChange(page + 1, pageSize)}
          disabled={page >= totalPages}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Last page"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onPaginationChange(totalPages, pageSize)}
          disabled={page >= totalPages}
        >
          <ChevronsRight />
        </Button>
      </div>
    </nav>
  )
}
