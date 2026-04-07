import { TrendingUp, TrendingDown, Minus } from "lucide-react"
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

export function ComparisonTable({ rows, title }: ComparisonTableProps) {
  return (
    <div>
      {title && <h3 className="text-sm font-medium mb-3">{title}</h3>}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-2 font-medium">Metric</th>
              <th className="text-right px-4 py-2 font-medium">Current</th>
              <th className="text-right px-4 py-2 font-medium">Previous</th>
              <th className="text-right px-4 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-t">
                <td className="px-4 py-2.5">{row.metric}</td>
                <td className="px-4 py-2.5 text-right font-medium">{row.current}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{row.previous}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    row.change > 0 ? "text-green-600" : row.change < 0 ? "text-red-600" : "text-muted-foreground"
                  )}>
                    {row.change > 0 ? <TrendingUp className="h-3 w-3" /> : row.change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {row.change > 0 ? "+" : ""}{row.change}%
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
