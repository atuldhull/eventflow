"use client"

import { useEffect, useRef, useState } from "react"
import {
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { DataTablePagination } from "./DataTablePagination"

/**
 * Optional, presentation-only column hints. A column opts in with
 * `meta: { align: "right" }` (amounts, counts, dates you compare) and the
 * header and cells line up on the right in tabular figures.
 */
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right" | "center"
    /** extra classes for this column's header and cells */
    className?: string
    /**
     * Pin the column to the table's right edge below the md breakpoint, so a row's actions
     * stay on screen on a phone while the other columns scroll sideways under them.
     */
    stickyRight?: boolean
  }
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  isLoading?: boolean
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
  onPaginationChange?: (page: number, pageSize: number) => void
  enableRowSelection?: boolean
  onRowSelectionChange?: (selectedRows: TData[]) => void
  emptyState?: React.ReactNode
}

const alignClass = (align?: "left" | "right" | "center") =>
  align === "right" ? "text-right [&>*]:ml-auto" : align === "center" ? "text-center [&>*]:mx-auto" : undefined

// A pinned actions column on phones: it stays at the right edge of the scroll box, over the
// columns scrolling under it, with a hairline on its left.
const STICKY_RIGHT = "max-md:sticky max-md:right-0 max-md:z-10 max-md:shadow-[-1px_0_0_0_var(--color-border)]"

const SKELETON_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-1/3", "w-2/3"]

const NO_SELECTION: RowSelectionState = {}

/** The rows of `data` a selection state points at (row ids are their indexes in `data`). */
export function selectedRowsOf<TData>(data: TData[], selection: RowSelectionState): TData[] {
  return Object.keys(selection)
    .filter((key) => selection[key])
    .map((key) => data[Number(key)])
    .filter((row): row is TData => row !== undefined)
}

/**
 * The product's table: a raised header row of 12px grey labels, 52px rows
 * split by hairline rules, a quiet hover, numbers in tabular figures. It sits
 * in its own bordered box and scrolls sideways inside it on narrow screens, so
 * the page itself never scrolls horizontally.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  pagination,
  onPaginationChange,
  enableRowSelection = false,
  onRowSelectionChange,
  emptyState,
}: DataTableProps<TData>) {
  const allColumns: ColumnDef<TData, unknown>[] = enableRowSelection
    ? [
        {
          id: "select",
          header: ({ table }) => (
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all rows on this page"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          ),
          size: 40,
        },
        ...columns,
      ]
    : columns

  // The table owns its selection (before, it kept none, so no checkbox ever stayed ticked).
  // A selection belongs to the rows it was made on: when `data` changes (another page, a
  // search, a refetch) it reads as empty, and a caller that was handed a non-empty
  // selection is told it is now empty.
  const [selection, setSelection] = useState<{ data: TData[]; state: RowSelectionState }>(() => ({
    data,
    state: NO_SELECTION,
  }))
  const rowSelection = selection.data === data ? selection.state : NO_SELECTION

  const onSelectionChangeRef = useRef(onRowSelectionChange)
  const toldNonEmpty = useRef(false)
  useEffect(() => {
    onSelectionChangeRef.current = onRowSelectionChange
  })
  useEffect(() => {
    if (!toldNonEmpty.current) return
    toldNonEmpty.current = false
    onSelectionChangeRef.current?.([])
  }, [data])

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next = typeof updater === "function" ? updater(rowSelection) : updater
    setSelection({ data, state: next })
    if (onRowSelectionChange) {
      const rows = selectedRowsOf(data, next)
      toldNonEmpty.current = rows.length > 0
      onRowSelectionChange(rows)
    }
  }

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions by design
  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: pagination?.total ?? data.length,
    enableRowSelection,
    state: { rowSelection },
    onRowSelectionChange: handleRowSelectionChange,
  })

  const header = (
    <TableHeader className="[&_tr]:border-b-0">
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className="border-b border-border bg-raised hover:bg-raised">
          {headerGroup.headers.map((h) => {
            const meta = h.column.columnDef.meta
            return (
              <TableHead
                key={h.id}
                className={cn(
                  "h-10 px-3 text-xs font-medium text-muted-foreground first:pl-4 last:pr-4",
                  h.column.id === "select" && "w-10",
                  meta?.stickyRight && cn(STICKY_RIGHT, "max-md:bg-raised"),
                  alignClass(meta?.align),
                  meta?.className,
                )}
              >
                {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            )
          })}
        </TableRow>
      ))}
    </TableHeader>
  )

  return (
    <div className="min-w-0 space-y-3">
      <div className="overflow-hidden rounded-lg border bg-background" aria-busy={isLoading || undefined}>
        <Table className="tabular-nums">
          {header}
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {allColumns.map((col, j) => (
                    <TableCell key={j} className="h-13 px-3 first:pl-4 last:pr-4">
                      <Skeleton
                        className={cn(
                          "h-3.5",
                          col.id === "select" ? "size-4" : SKELETON_WIDTHS[(i + j) % SKELETON_WIDTHS.length],
                          col.meta?.align === "right" && "ml-auto",
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50 data-[state=selected]:bg-brand/6"
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "h-13 px-3 py-2 text-sm first:pl-4 last:pr-4",
                          meta?.stickyRight && cn(STICKY_RIGHT, "max-md:bg-background max-md:[tr[data-state=selected]_&]:bg-[color-mix(in_oklab,var(--color-brand)_6%,var(--color-background))]"),
                          alignClass(meta?.align),
                          meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="h-40 px-4 text-center whitespace-normal">
                  {emptyState || <p className="text-sm text-muted-foreground">No results found.</p>}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && onPaginationChange && (
        <DataTablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPaginationChange={onPaginationChange}
        />
      )}
    </div>
  )
}
