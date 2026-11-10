import { cn } from "@/lib/utils"

/** "Nov" over a big Bricolage day number: the date block used across the attendee area. */
export function DateBlock({ date, className, size = "md" }: { date: Date; className?: string; size?: "md" | "lg" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-md border bg-frame leading-none",
        size === "lg" ? "w-14 py-2" : "w-12 py-1.5",
        className,
      )}
    >
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {date.toLocaleDateString("en-IN", { month: "short" })}
      </span>
      <span className={cn("font-display mt-0.5 font-bold tracking-[-0.03em] tabular-nums", size === "lg" ? "text-[24px]" : "text-[20px]")}>
        {date.getDate()}
      </span>
    </div>
  )
}

/**
 * A friendly empty area: says what's missing in a human way and points at the next step.
 * No illustration; the display-font line carries it.
 */
export function DashEmpty({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-dashed px-6 py-12 text-center sm:py-14", className)}>
      <p className="font-display text-[22px] leading-7 font-bold tracking-[-0.025em] text-foreground">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-[44ch] text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

/** A settings row: the label column on the left, its panel on the right (stacked on phones). */
export function SettingsSection({
  title,
  description,
  children,
  tone = "default",
  panel = true,
}: {
  title: string
  description: string
  children: React.ReactNode
  tone?: "default" | "danger"
  /** wrap the content in a bordered panel (off when the content brings its own frame) */
  panel?: boolean
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div className="md:pt-1">
        <h2 className={cn("text-[15px] font-semibold", tone === "danger" && "text-destructive")}>{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "min-w-0",
          panel && "rounded-xl border bg-card p-5",
          panel && tone === "danger" && "border-destructive/40",
        )}
      >
        {children}
      </div>
    </section>
  )
}

/** Picks one of the brand poster tones from a string, so the same event always gets the same colour. */
const POSTER_TONES = [
  { surface: "bg-lemon text-lemon-ink", sub: "text-lemon-ink/70", notch: "lemon" },
  { surface: "bg-lavender text-charcoal", sub: "text-charcoal/75", notch: "lavender" },
  { surface: "bg-charcoal text-lemon ring-1 ring-inset ring-white/10", sub: "text-white/70", notch: "charcoal" },
  { surface: "bg-[#efe6ff] text-[#2a1260] dark:bg-[#241a38] dark:text-[#e6d6ff]", sub: "text-[#4a1fa8] dark:text-[#c9a6ff]", notch: "lilac" },
] as const

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * The stand-in for an event with no cover image: a small poster in a brand colour chosen from
 * the event, with the date set huge and the category, plus ticket-stub notches on the sides.
 */
export function PosterFallback({ seed, date, category, className }: { seed: string; date: Date; category?: string | null; className?: string }) {
  const tone = POSTER_TONES[hash(seed) % POSTER_TONES.length]
  return (
    <div aria-hidden className={cn("relative flex size-full flex-col justify-between overflow-hidden p-4", tone.surface, className)}>
      <div className="flex items-start justify-between gap-3 text-[12px] font-semibold tracking-wide uppercase">
        <span className={tone.sub}>{category || "Event"}</span>
        <span className={tone.sub}>{date.toLocaleDateString("en-IN", { weekday: "short" })}</span>
      </div>
      <div className="flex items-end gap-2 leading-none">
        <span className="font-display text-[64px] font-extrabold tracking-[-0.06em] tabular-nums">{date.getDate()}</span>
        <span className="font-display mb-2 text-[22px] font-bold tracking-[-0.03em]">
          {date.toLocaleDateString("en-IN", { month: "short" })}
        </span>
      </div>
      <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-background" />
      <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-background" />
    </div>
  )
}
