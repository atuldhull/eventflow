import { cn } from "@/lib/utils"

interface ComparisonRow {
  metric: string
  current: string | number
  previous: string | number
  change: number
}

interface ComparisonTableProps {
  rows: ComparisonRow[]
  title?: string
}

/** This period against the last: figures right-aligned, the change as a signed percentage. */
export function ComparisonTable({ rows, title }: ComparisonTableProps) {
  return (
    <div className="min-w-0">
      {title && <h3 className="mb-2 text-[15px] font-semibold">{title}</h3>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[420px] text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-raised text-xs text-muted-foreground">
              <th scope="col" className="h-10 px-4 text-left font-medium">Metric</th>
              <th scope="col" className="h-10 px-3 text-right font-medium">Current</th>
              <th scope="col" className="h-10 px-3 text-right font-medium">Previous</th>
              <th scope="col" className="h-10 px-4 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map((row) => (
              <tr key={row.metric}>
                <td className="h-12 px-4">{row.metric}</td>
                <td className="h-12 px-3 text-right font-medium">{row.current}</td>
                <td className="h-12 px-3 text-right text-muted-foreground">{row.previous}</td>
                <td className="h-12 px-4 text-right">
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      row.change > 0 ? "text-positive" : row.change < 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {row.change > 0 ? "+" : row.change < 0 ? "−" : ""}
                    {Math.abs(row.change)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
