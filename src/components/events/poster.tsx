import { cn } from "@/lib/utils"

/**
 * The designed stand-in for a missing cover photo: a poster in one of the brand's colour
 * fields, picked from the event's slug so every event keeps its own look and a grid of
 * them reads varied. Pure presentation, no client code, so cards can render it anywhere.
 */

export interface PosterTheme {
  /** background + ink of the poster field */
  field: string
  /** the colour of the accent shape (a disc, a band) */
  accent: string
  /** the hairline/pattern colour */
  line: string
}

// Fixed hex on purpose: a poster keeps its colours in light and dark mode.
const THEMES: PosterTheme[] = [
  { field: "bg-[#FFF21A] text-[#171717]", accent: "bg-[#A66BFF]", line: "text-[#171717]" },
  { field: "bg-[#A66BFF] text-[#171717]", accent: "bg-[#FFF21A]", line: "text-[#171717]" },
  { field: "bg-[#4C1D95] text-white", accent: "bg-[#FFF21A]", line: "text-[#C9A8FF]" },
  { field: "bg-[#1C1C1C] text-[#FFF21A] ring-1 ring-inset ring-white/10", accent: "bg-[#A66BFF]", line: "text-[#FFF21A]" },
  { field: "bg-[#F3EFE6] text-[#171717]", accent: "bg-[#7A3FF2]", line: "text-[#171717]" },
]

const PATTERNS = 4

/** A small stable hash (FNV-1a) so the same slug always gets the same poster. */
export function posterSeed(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function posterTheme(key: string): PosterTheme {
  return THEMES[posterSeed(key) % THEMES.length]
}

/**
 * The poster's graphic layer: one of four shapes (rings, stripes, dots, a sun disc with a
 * band), coloured from the theme. Sits absolutely inside a `relative overflow-hidden` field.
 */
export function PosterPattern({ seed, className }: { seed: string; className?: string }) {
  const n = posterSeed(seed)
  const theme = THEMES[n % THEMES.length]
  const pattern = Math.floor(n / THEMES.length) % PATTERNS
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]",
        className,
      )}
    >
      {pattern === 0 && (
        <>
          <span className={cn("absolute -top-[30%] -right-[18%] aspect-square w-[78%] rounded-full", theme.accent)} />
          <span
            className={cn("absolute -top-[30%] -right-[18%] aspect-square w-[78%] rounded-full opacity-25", theme.line)}
            style={{ backgroundImage: "repeating-radial-gradient(circle, currentColor 0 1.5px, transparent 1.5px 16px)" }}
          />
        </>
      )}
      {pattern === 1 && (
        <>
          <span
            className={cn("absolute inset-y-0 right-0 w-[55%] opacity-20", theme.line)}
            style={{ backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 14px)" }}
          />
          <span className={cn("absolute top-[14%] right-[10%] size-[22%] min-w-12 rotate-12 rounded-[22%]", theme.accent)} />
        </>
      )}
      {pattern === 2 && (
        <>
          <span
            className={cn("absolute inset-0 opacity-25", theme.line)}
            style={{
              backgroundImage: "radial-gradient(currentColor 1.4px, transparent 1.6px)",
              backgroundSize: "16px 16px",
              maskImage: "linear-gradient(200deg, #000 15%, transparent 65%)",
            }}
          />
          <span className={cn("absolute -top-[34%] -right-[14%] aspect-square w-[58%] rounded-full", theme.accent)} />
        </>
      )}
      {pattern === 3 && (
        <>
          <span className={cn("absolute top-[16%] -right-[12%] h-[20%] w-[80%] -rotate-[14deg]", theme.accent)} />
          <span
            className={cn("absolute top-[4%] right-[16%] aspect-square w-[26%] rounded-full border-[3px] opacity-60", theme.line)}
            style={{ borderColor: "currentColor" }}
          />
        </>
      )}
    </div>
  )
}

/**
 * The perforated edge between a ticket's two halves: a dashed rule with a round notch cut
 * out on each side. The notches take the colour of the surface behind the ticket.
 */
export function Perforation({ className, notchClassName = "bg-background" }: { className?: string; notchClassName?: string }) {
  return (
    <div aria-hidden className={cn("relative h-0", className)}>
      <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-border" />
      <span className={cn("absolute top-0 -left-3 size-6 -translate-y-1/2 rounded-full border", notchClassName)} />
      <span className={cn("absolute top-0 -right-3 size-6 -translate-y-1/2 rounded-full border", notchClassName)} />
    </div>
  )
}
