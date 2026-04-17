"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { EventData } from "./types"

export function EventFAQs({ faqs }: { faqs: EventData["faqs"] }) {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  if (faqs.length === 0) return null
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">FAQs</h2>
      <div className="space-y-2">
        {faqs.map((faq) => (
          <Card key={faq.id} className="overflow-hidden">
            <button
              onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-medium">{faq.question}</span>
              {expandedFaq === faq.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {expandedFaq === faq.id && (
              <div className="px-4 pb-4">
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </section>
  )
}
