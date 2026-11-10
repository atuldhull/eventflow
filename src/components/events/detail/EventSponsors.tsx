"use client"

import { ArrowUpRight } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { statusLabel } from "@/lib/status-tone"
import { EventSection } from "./EventSection"
import type { EventData } from "./types"

export function EventSponsors({ sponsors }: { sponsors: EventData["sponsors"] }) {
  if (sponsors.length === 0) return null
  return (
    <EventSection id="sponsors" title="Sponsors">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sponsors.map((sp) => (
          <li key={sp.id} className="flex items-center gap-3 rounded-[18px] border bg-card p-4 transition-colors hover:border-lavender/50">
            {sp.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sp.logo} alt={sp.name} className="size-12 shrink-0 rounded-xl border border-rule bg-white object-contain p-1.5" />
            ) : (
              <span aria-hidden className="font-display flex size-12 shrink-0 items-center justify-center rounded-xl bg-lavender text-[18px] font-extrabold text-charcoal">
                {sp.name[0]}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{sp.name}</p>
              <Pill tone="neutral" className="mt-1">{statusLabel(sp.tier)}</Pill>
            </div>
            {sp.website && (
              <a
                href={sp.website}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${sp.name} website`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground pointer-coarse:size-11"
              >
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </EventSection>
  )
}
