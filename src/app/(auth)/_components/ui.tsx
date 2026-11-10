import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/** Roomier fields for the sign-in pages: 48px tall, rounded, 15px text. Merged onto <Input>. */
export const authField = "h-12 rounded-xl px-4 text-[15px] md:text-[15px] pointer-coarse:h-12"

/** Full-width primary/secondary actions on these pages. Merged onto <Button size="lg">. */
export const authAction = "h-12 text-[15px] pointer-coarse:h-12"

/** The eye toggle that sits inside a password field and covers its full height. */
export const revealButton =
  "absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"

/** The inline field error, with an icon so it reads as an error without colour too. */
export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-[13px] leading-snug text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/**
 * Page heading for the auth screens: a small eyebrow, a Bricolage headline whose
 * `mark` phrase sits on the brand's slightly rotated lemon highlighter, and a sub line.
 */
export function AuthHeading({
  eyebrow,
  title,
  mark,
  after,
  children,
  role,
}: {
  eyebrow?: string
  title: string
  /** the phrase drawn on the lemon highlighter, placed after `title` */
  mark?: string
  /** text after the highlighted phrase (e.g. a full stop) */
  after?: string
  children?: React.ReactNode
  role?: string
}) {
  return (
    <div role={role}>
      {eyebrow && <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">{eyebrow}</p>}
      <h1 className={cn("font-display text-[34px] leading-[1.04] font-extrabold tracking-[-0.04em] sm:text-[40px]", eyebrow && "mt-2.5")}>
        {title}
        {mark && (
          <>
            {" "}
            <span className="relative z-0 inline-block px-[0.06em] whitespace-nowrap text-lemon-ink">
              <span aria-hidden className="auth-mark absolute -inset-x-[0.04em] top-[0.06em] bottom-[0.02em] -z-10 origin-left -rotate-[1.5deg] rounded-[0.16em] bg-lemon" />
              {mark}
            </span>
          </>
        )}
        {after}
      </h1>
      {children && <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  )
}

/** An error banner for ?error= messages and similar. */
export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-pill-negative px-4 py-3.5 text-sm leading-relaxed text-pill-negative-foreground">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
