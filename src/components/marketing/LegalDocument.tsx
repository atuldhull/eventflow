import { Container, PageIntro } from "./layout"

export interface LegalSection {
  id: string
  title: string
  body: React.ReactNode
}

/**
 * A legal page: the title and its date, then numbered sections at a 68ch
 * reading measure, with an "On this page" index beside them on wide screens.
 */
export function LegalDocument({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <>
      <PageIntro title={title} meta={<>Last updated: {updated}</>} />
      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-[13px] font-medium">On this page</p>
            <ol className="mt-3 border-l border-border">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px flex gap-2 border-l border-transparent py-1.5 pl-4 text-[13px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                  >
                    <span className="tabular-nums">{i + 1}.</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-[68ch]">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 border-t border-rule py-8 first:border-t-0 first:pt-0 last:pb-0">
              <h2 id={`${s.id}-title`} className="flex gap-2 text-lg leading-snug font-semibold">
                <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="mt-3 space-y-4 text-[15px] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-brand">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </Container>
    </>
  )
}
