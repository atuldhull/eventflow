"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { EventSection } from "./EventSection"
import type { EventData } from "./types"

/** Accordion rows between hairlines; one answer open at a time. */
export function EventFAQs({ faqs }: { faqs: EventData["faqs"] }) {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  if (faqs.length === 0) return null
  return (
    <EventSection id="faqs" title="FAQs">
      <div className="-mt-1 divide-y divide-rule border-b border-rule">
        {faqs.map((faq) => {
          const open = expandedFaq === faq.id
          return (
            <div key={faq.id}>
              <h3>
                <button
                  type="button"
                  onClick={() => setExpandedFaq(open ? null : faq.id)}
                  aria-expanded={open}
                  aria-controls={`faq-${faq.id}`}
                  className="flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left text-sm font-medium transition-colors hover:text-foreground/80"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
                    aria-hidden
                  />
                </button>
              </h3>
              {open && (
                <div id={`faq-${faq.id}`} className="pr-8 pb-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {faq.answer}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </EventSection>
  )
}
