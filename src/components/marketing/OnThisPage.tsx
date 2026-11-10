"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * The "On this page" index of a long page. It marks the section being read
 * (the last heading that has passed the top third of the screen).
 */
export function OnThisPage({ items, numbered = false, className }: { items: { id: string; label: string }[]; numbered?: boolean; className?: string }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.33
      let current = items[0]?.id ?? null
      for (const { id } of items) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [items])

  return (
    <nav aria-label="On this page" className={className}>
      <p className="font-display text-[13px] font-bold tracking-[0.08em] text-muted-foreground uppercase">On this page</p>
      <ol className="mt-4 space-y-0.5">
        {items.map((t, i) => {
          const on = active === t.id
          return (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                aria-current={on ? "location" : undefined}
                className={cn(
                  "flex gap-2.5 rounded-lg px-3 py-1.5 text-[14px] leading-snug transition-colors",
                  on ? "bg-lemon font-medium text-lemon-ink" : "text-muted-foreground hover:bg-raised hover:text-foreground",
                )}
              >
                {numbered && <span className="w-5 shrink-0 tabular-nums">{i + 1}.</span>}
                {t.label}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
