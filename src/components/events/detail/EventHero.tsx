"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Badge } from "@/components/ui/badge"
import { SplitTextReveal } from "@/components/motion/SplitTextReveal"
import { statusConfig, type EventData } from "./types"

export function EventHero({ event }: { event: EventData }) {
  const status = statusConfig[event.status] || statusConfig.PUBLISHED
  const rootRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!rootRef.current) return

    gsap.registerPlugin(ScrollTrigger)

    const triggers: ScrollTrigger[] = []

    // Cover image slowly scales and drifts upward as you scroll past the hero.
    if (imageRef.current) {
      const t = gsap.to(imageRef.current, {
        scale: 1.15,
        yPercent: -12,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.5,
        },
      })
      if (t.scrollTrigger) triggers.push(t.scrollTrigger)
    }

    // The dark overlay intensifies as the hero leaves the viewport, fading
    // title/meta text so the next section transitions in cleanly.
    if (overlayRef.current) {
      const t = gsap.to(overlayRef.current, {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "center top",
          end: "bottom top",
          scrub: 0.5,
        },
      })
      if (t.scrollTrigger) triggers.push(t.scrollTrigger)
    }

    return () => { triggers.forEach((tr) => tr.kill()) }
  }, [])

  return (
    <div ref={rootRef} className="relative h-64 sm:h-80 lg:h-96 bg-linear-to-br from-primary/20 to-primary/5 overflow-hidden">
      {event.coverImage && (
        <img
          ref={imageRef}
          src={event.coverImage}
          alt={event.title}
          className="w-full h-full object-cover absolute inset-0 will-change-transform"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/30 opacity-0 pointer-events-none"
        aria-hidden="true"
      />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className={status.color}>{status.label}</Badge>
            <Badge variant="secondary">{event.category}</Badge>
            {event.isFeatured && <Badge className="bg-amber-500 text-white">Featured</Badge>}
            {event.type !== "SINGLE" && <Badge variant="outline" className="border-white/30 text-white">{event.type.replace(/_/g, " ")}</Badge>}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
            <SplitTextReveal as="span">{event.title}</SplitTextReveal>
          </h1>
          <p className="text-white/80 mt-2 max-w-2xl text-sm sm:text-base">{event.shortDescription}</p>
          <div className="flex items-center gap-3 mt-3 text-white/70 text-sm">
            <span>by {event.organization.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
