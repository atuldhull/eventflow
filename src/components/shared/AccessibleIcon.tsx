import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccessibleIconProps {
  icon: LucideIcon
  label: string
  decorative?: boolean
  className?: string
  size?: number
}

export function AccessibleIcon({ icon: Icon, label, decorative = false, className, size }: AccessibleIconProps) {
  if (decorative) {
    return <Icon className={className} size={size} aria-hidden="true" />
  }

  return (
    <span role="img" aria-label={label}>
      <Icon className={className} size={size} aria-hidden="true" />
    </span>
  )
}
