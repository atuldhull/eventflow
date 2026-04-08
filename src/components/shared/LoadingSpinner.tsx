import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  variant?: "spinner" | "dots" | "pulse"
  label?: string
  className?: string
}

const sizeMap = { sm: 16, md: 24, lg: 40 }

export function LoadingSpinner({ size = "md", variant = "spinner", label = "Loading", className }: LoadingSpinnerProps) {
  const px = sizeMap[size]

  if (variant === "dots") {
    return (
      <span className={cn("loading-dots inline-flex items-center", className)} role="status" aria-label={label}>
        <span /><span /><span />
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  if (variant === "pulse") {
    return (
      <span className={cn("inline-block animate-pulse", className)} role="status" aria-label={label} style={{ width: px, height: px }}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-primary">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.6" />
        </svg>
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  // Default spinner — chase arc
  return (
    <svg className={cn("animate-spin text-primary", className)} style={{ width: px, height: px }} viewBox="0 0 24 24" fill="none" role="status" aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.15" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <span className="sr-only">{label}</span>
    </svg>
  )
}
