import { cn } from "@/lib/utils"

/**
 * A ticket's tear line: a dashed rule with a half-circle notch cut from each edge.
 * `notchClassName` is the colour of the surface behind the ticket, so the notches
 * read as cut-outs; `lineClassName` colours the dashes.
 */
export function Perforation({
  notchClassName = "bg-background",
  lineClassName = "border-border",
  className,
}: {
  notchClassName?: string
  lineClassName?: string
  className?: string
}) {
  return (
    <div className={cn("relative h-0 border-t-2 border-dashed", lineClassName, className)} aria-hidden>
      <span className={cn("absolute -top-[10px] -left-[10px] size-[18px] rounded-full", notchClassName)} />
      <span className={cn("absolute -top-[10px] -right-[10px] size-[18px] rounded-full", notchClassName)} />
    </div>
  )
}
