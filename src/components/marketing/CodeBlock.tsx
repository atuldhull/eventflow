"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

/** strings, numbers and a few keywords, coloured; everything else stays plain */
const TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:const|require|true|false|null|curl)\b|\b\d+\b)/g

function highlight(code: string) {
  return code.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return part
    if (part.startsWith('"') || part.startsWith("'")) return <span key={i} className="text-lemon">{part}</span>
    if (/^\d+$/.test(part)) return <span key={i} className="text-[#ffb38a]">{part}</span>
    return <span key={i} className="text-lavender">{part}</span>
  })
}

/** A code sample on an always-dark sheet, with its language label and a copy button. */
export function CodeBlock({ label, children, className }: { label: string; children: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <figure className={cn("overflow-hidden rounded-2xl border border-white/10 bg-[#111111] text-white shadow-[0_24px_60px_-30px_rgb(0_0_0/0.6)]", className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 py-1.5 pr-1.5 pl-4">
        <span className="flex items-center gap-3 text-xs text-white/55">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-lemon/80" />
          </span>
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(children)
              .then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              })
              .catch(() => {})
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-lemon"
        >
          {copied ? <Check className="size-3.5 text-lemon" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-6 text-white/90">
        <code>{highlight(children)}</code>
      </pre>
    </figure>
  )
}
