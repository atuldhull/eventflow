import { cn } from "@/lib/utils"

interface SkeletonCardProps {
  variant?: "event-card" | "stat-card" | "list-item" | "table-row"
  className?: string
}

function Bone({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded", className)} />
}

export function SkeletonCard({ variant = "event-card", className }: SkeletonCardProps) {
  if (variant === "stat-card") {
    return (
      <div className={cn("rounded-xl border p-5 space-y-3", className)}>
        <div className="flex items-center justify-between">
          <Bone className="h-4 w-20" />
          <Bone className="h-8 w-8 rounded-full" />
        </div>
        <Bone className="h-8 w-24" />
        <Bone className="h-3 w-16" />
      </div>
    )
  }

  if (variant === "list-item") {
    return (
      <div className={cn("flex items-center gap-3 px-4 py-3", className)}>
        <Bone className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Bone className="h-3.5 w-3/5" />
          <Bone className="h-3 w-2/5" />
        </div>
        <Bone className="h-5 w-14 rounded-full" />
      </div>
    )
  }

  if (variant === "table-row") {
    return (
      <div className={cn("flex items-center gap-4 px-4 py-3 border-b", className)}>
        <Bone className="h-4 w-4 rounded shrink-0" />
        <Bone className="h-3.5 w-1/4" />
        <Bone className="h-3.5 w-1/6" />
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="h-3.5 w-1/5 ml-auto" />
      </div>
    )
  }

  // Default: event-card
  return (
    <div className={cn("rounded-xl border overflow-hidden", className)}>
      <Bone className="aspect-video w-full rounded-none" />
      <div className="p-4 space-y-2.5">
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3 w-1/2" />
        <div className="flex gap-3 pt-1">
          <Bone className="h-3 w-20" />
          <Bone className="h-3 w-16" />
        </div>
        <Bone className="h-8 w-full rounded-md mt-2" />
      </div>
    </div>
  )
}
