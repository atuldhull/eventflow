import { QrGlyph } from "@/components/marketing/QrGlyph"
import { cn } from "@/lib/utils"

/** A jagged vertical tear down the right (or left) edge, as a clip-path polygon. */
function tear(side: "right" | "left", teeth = 18, depth = 12) {
  const pts: string[] = []
  for (let i = 0; i <= teeth * 2; i++) {
    const y = ((i / (teeth * 2)) * 100).toFixed(2)
    const x = i % 2 ? `calc(100% - ${depth}px)` : "100%"
    pts.push(side === "right" ? `${x} ${y}%` : `${i % 2 ? `${depth}px` : "0px"} ${y}%`)
  }
  return side === "right" ? `polygon(0 0, ${pts.join(", ")}, 0 100%)` : `polygon(${pts.join(", ")}, 100% 100%, 100% 0)`
}

/**
 * The system pages' illustration: an admission ticket whose stub has been torn off and
 * dropped beside it. `big` is the huge number or word on the ticket; `rows` fill the
 * details grid. Decorative, so hidden from assistive technology.
 */
export function TornTicket({
  big,
  rows,
  stubLabel,
  badge = "Void",
  bigClassName,
  code,
  className,
}: {
  big: string
  rows: [string, string][]
  stubLabel: string
  /** the stamp in the corner */
  badge?: string
  bigClassName?: string
  code: string
  className?: string
}) {
  return (
    <div aria-hidden className={cn("relative mx-auto w-full max-w-[460px] select-none", className)}>
      <div className="absolute inset-[8%] -z-10 rounded-full bg-lavender/40 blur-[90px]" />

      {/* the ticket, its right edge torn */}
      <div className="sys-drop -rotate-[4deg] drop-shadow-[0_30px_50px_rgb(0_0_0/0.35)]">
        <div className="relative bg-lavender pr-8 text-charcoal" style={{ clipPath: tear("right"), borderRadius: "22px 0 0 22px" }}>
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 text-[12px] font-semibold tracking-[0.14em] uppercase">
              <span>Admit one</span>
              <span className="rounded-full border-[1.5px] border-charcoal px-2.5 py-0.5 tracking-[0.1em]">{badge}</span>
            </div>
            <p className={cn("font-display mt-4 text-[96px] leading-[0.85] font-extrabold tracking-[-0.06em] sm:text-[128px]", bigClassName)}>{big}</p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t-2 border-dashed border-charcoal/35 pt-5 text-[13px]">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-charcoal/80">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* the stub, torn off and dropped */}
      <div className="absolute -right-1 -bottom-28 w-[120px] sm:-right-12 sm:-bottom-14 sm:w-[150px] lg:-right-16">
        <div className="sys-stub rotate-[11deg] drop-shadow-[0_20px_30px_rgb(0_0_0/0.3)]">
          <div
            className="flex flex-col items-center gap-2 bg-lemon py-5 pr-4 pl-6 text-lemon-ink"
            style={{ clipPath: tear("left", 14, 10), borderRadius: "0 18px 18px 0" }}
          >
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase">{stubLabel}</span>
            <QrGlyph seed={code} className="size-16 opacity-80 sm:size-[72px]" />
            <span className="font-mono text-[10.5px] tracking-wide">{code}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Page-local motion for the system pages: the ticket drops in, the stub keeps swinging. */
export const SYSTEM_CSS = `
@keyframes sys-drop { from { opacity: 0; transform: translateY(-40px) rotate(-10deg); } to { opacity: 1; transform: none; } }
@keyframes sys-stub { 0%,100% { transform: rotate(0deg) translateY(0); } 50% { transform: rotate(-5deg) translateY(-8px); } }
@keyframes sys-mark { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.sys-drop { animation: sys-drop .9s cubic-bezier(.22,1,.36,1) both; }
.sys-stub { animation: sys-drop .9s cubic-bezier(.22,1,.36,1) .25s both, sys-stub 5s ease-in-out 1.2s infinite; transform-origin: 0 0; }
.sys-mark { animation: sys-mark .7s cubic-bezier(.22,1,.36,1) .4s both; }
@media (prefers-reduced-motion: reduce) { .sys-drop, .sys-stub, .sys-mark { animation: none; } }
`

/** A headline phrase on the lemon highlighter. */
export function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative z-0 inline-block px-[0.06em] whitespace-nowrap text-lemon-ink">
      <span aria-hidden className="sys-mark absolute -inset-x-[0.04em] top-[0.06em] bottom-[0.02em] -z-10 origin-left -rotate-[1.5deg] rounded-[0.16em] bg-lemon" />
      {children}
    </span>
  )
}
