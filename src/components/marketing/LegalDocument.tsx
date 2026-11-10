import { ChevronDown } from "lucide-react"
import { Container } from "./layout"
import { Highlighter } from "./kit"
import { OnThisPage } from "./OnThisPage"

export interface LegalSection {
  id: string
  title: string
  body: React.ReactNode
}

/**
 * A legal page. The brand lives in the header only (a big display title with the
 * lemon highlighter on its last word); the body is calm long-form at a 68ch
 * measure, with numbered sections and an "On this page" index that stays beside
 * them on wide screens and folds into a disclosure on phones.
 */
export function LegalDocument({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  const words = title.split(" ")
  const last = words.pop()
  const toc = sections.map((s) => ({ id: s.id, label: s.title }))

  return (
    <>
      <header className="relative -mt-16 overflow-hidden border-b border-rule pt-16">
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <Container className="pt-14 pb-12 sm:pt-20 sm:pb-16">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
            Legal
          </p>
          <h1 className="font-display mt-4 text-[44px] leading-[1] font-extrabold tracking-[-0.045em] text-balance sm:text-[72px]">
            {words.join(" ")} <Highlighter delay={0.2}>{last}</Highlighter>
          </h1>
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-muted-foreground">
            <span className="inline-flex items-center rounded-full border px-3 py-1 font-medium text-foreground">Last updated: {updated}</span>
            <span className="tabular-nums">{sections.length} sections</span>
          </p>
        </Container>
      </header>

      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-20">
        <div className="hidden lg:block">
          <OnThisPage items={toc} numbered className="sticky top-24 max-h-[calc(100svh-8rem)] overflow-y-auto" />
        </div>

        <div className="min-w-0">
          {/* phones and tablets: the index folds away above the text */}
          <details className="group mb-10 rounded-2xl border lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="border-t border-rule px-2 py-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[15px] text-muted-foreground hover:bg-raised hover:text-foreground">
                    <span className="w-5 shrink-0 tabular-nums">{i + 1}.</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          <article className="max-w-[68ch]">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 border-t border-rule py-10 first:border-t-0 first:pt-0 last:pb-0">
                <h2 id={`${s.id}-title`} className="flex items-baseline gap-3 text-[22px] leading-snug font-semibold tracking-[-0.015em] sm:text-[24px]">
                  <span className="text-[15px] font-medium text-brand tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-5 text-[16.5px] leading-[1.75] text-foreground/80 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:decoration-lavender [&_a]:decoration-2 [&_a]:underline-offset-4 [&_a:hover]:text-brand [&_li]:pl-1 [&_li+li]:mt-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-brand">
                  {s.body}
                </div>
              </section>
            ))}
          </article>
        </div>
      </Container>
    </>
  )
}
