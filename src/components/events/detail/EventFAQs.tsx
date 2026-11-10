"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { EventSection } from "./EventSection"
import type { EventData } from "./types"

/** Numbered accordion rows between dashed rules; one answer open at a time. */
export function EventFAQs({ faqs }: { faqs: EventData["faqs"] }) {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  if (faqs.length === 0) return null
  return (
    <EventSection id="faqs" title="FAQs">
      <div className="overflow-hidden rounded-[22px] border bg-card">
        {faqs.map((faq, i) => {
          const open = expandedFaq === faq.id
          return (
            <div key={faq.id} className={cn("border-dashed border-border not-first:border-t-2", open && "bg-lavender/[0.06]")}>
              <h3>
                <button
                  type="button"
                  onClick={() => setExpandedFaq(open ? null : faq.id)}
                  aria-expanded={open}
                  aria-controls={`faq-${faq.id}`}
                  className="group flex min-h-14 w-full items-center gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
                >
                  <span aria-hidden className="font-display w-7 shrink-0 text-[15px] font-extrabold text-brand tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[16px] font-semibold">{faq.question}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,color] duration-300",
                      open ? "rotate-45 border-transparent bg-lemon text-lemon-ink" : "text-muted-foreground group-hover:border-lavender",
                    )}
                  >
                    <Plus className="size-4" />
                  </span>
                </button>
              </h3>
              {open && (
                <div id={`faq-${faq.id}`} className="pr-6 pb-5 pl-16 text-[15px] leading-relaxed whitespace-pre-wrap text-muted-foreground sm:pr-16 sm:pl-[68px]">
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
