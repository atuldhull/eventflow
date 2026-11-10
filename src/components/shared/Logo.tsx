import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * The EventFlow mark: a ticket stub (the product's own artefact) with its
 * perforation notches. Drawn in currentColor so it follows the ink.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <path
        fill="currentColor"
        d="M5 4h14a2 2 0 0 1 2 2v3.2a2.8 2.8 0 0 0 0 5.6V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.2a2.8 2.8 0 0 0 0-5.6V6a2 2 0 0 1 2-2Zm9.25 2.75v1.5h1.5v-1.5h-1.5Zm0 3.5v1.5h1.5v-1.5h-1.5Zm0 3.5v1.5h1.5v-1.5h-1.5Zm0 3.5v.5h1.5v-.5h-1.5Z"
      />
    </svg>
  )
}

export function Logo({ className, href = "/", label = true }: { className?: string; href?: string; label?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-foreground", className)} aria-label="EventFlow home">
      <LogoMark />
      {label && <span className="text-[15px] font-semibold tracking-[-0.01em]">EventFlow</span>}
    </Link>
  )
}
