"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

function Stars({ rating, color }: { rating: number; color: string }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4" fill={i < rating ? color : "transparent"} stroke={i < rating ? color : "currentColor"} style={{ opacity: i < rating ? 1 : 0.2 }} />)}</div>
}

export function Testimonials({ config, content, siteStyles, isPreview }: SectionProps) {
  const testimonials: any[] = content.testimonials || []
  const layout = config.layout || "carousel"
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent((c) => (c + 1) % testimonials.length), [testimonials.length])
  const prev = useCallback(() => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length), [testimonials.length])

  useEffect(() => {
    if (layout !== "carousel" || !config.autoRotate || testimonials.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [layout, config.autoRotate, testimonials.length, next])

  if (!isPreview && testimonials.length === 0) return null

  const renderCard = (t: any, i: number) => (
    <motion.div key={i} variants={item} className="p-6 rounded-2xl border" style={{ borderColor: siteStyles.textColor + "10", borderRadius: siteStyles.borderRadius }}>
      <Quote className="h-6 w-6 mb-3 opacity-20" style={{ color: siteStyles.primaryColor }} />
      <p className="italic leading-relaxed opacity-80" style={{ color: siteStyles.textColor }}>{t.quote}</p>
      <div className="flex items-center gap-3 mt-4">
        {t.avatar ? <Image src={t.avatar} alt={t.name} width={40} height={40} className="rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: siteStyles.primaryColor }}>{t.name?.[0]}</div>}
        <div><p className="text-sm font-medium" style={{ color: siteStyles.textColor }}>{t.name}</p>{t.role && <p className="text-xs opacity-50" style={{ color: siteStyles.textColor }}>{t.role}</p>}</div>
      </div>
      {config.showRating && t.rating && <div className="mt-3"><Stars rating={t.rating} color={siteStyles.primaryColor} /></div>}
    </motion.div>
  )

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{content.heading}</motion.h2>}

        {testimonials.length > 0 ? (
          layout === "carousel" ? (
            <div className="max-w-2xl mx-auto relative">
              <AnimatePresence mode="wait">
                <motion.div key={current} className="text-center" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                  <Quote className="h-10 w-10 mx-auto mb-4 opacity-10" style={{ color: siteStyles.primaryColor }} />
                  <p className="text-lg sm:text-xl italic leading-relaxed opacity-80" style={{ color: siteStyles.textColor }}>&ldquo;{testimonials[current].quote}&rdquo;</p>
                  <div className="flex items-center justify-center gap-3 mt-6">
                    {testimonials[current].avatar ? <Image src={testimonials[current].avatar} alt={testimonials[current].name} width={48} height={48} className="rounded-full" /> : <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: siteStyles.primaryColor }}>{testimonials[current].name?.[0]}</div>}
                    <div className="text-left"><p className="font-medium" style={{ color: siteStyles.textColor }}>{testimonials[current].name}</p>{testimonials[current].role && <p className="text-sm opacity-50" style={{ color: siteStyles.textColor }}>{testimonials[current].role}</p>}</div>
                  </div>
                  {config.showRating && testimonials[current].rating && <div className="flex justify-center mt-3"><Stars rating={testimonials[current].rating} color={siteStyles.primaryColor} /></div>}
                </motion.div>
              </AnimatePresence>
              {testimonials.length > 1 && <>
                <button onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full opacity-30 hover:opacity-100 transition-opacity hidden md:block" style={{ color: siteStyles.textColor }}><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full opacity-30 hover:opacity-100 transition-opacity hidden md:block" style={{ color: siteStyles.textColor }}><ChevronRight className="h-5 w-5" /></button>
                <div className="flex justify-center gap-1.5 mt-8">{testimonials.map((_: any, i: number) => <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all ${i === current ? "w-6" : "w-2 opacity-30"}`} style={{ backgroundColor: siteStyles.primaryColor }} />)}</div>
              </>}
            </div>
          ) : (
            <motion.div className={`grid gap-6 ${layout === "masonry" ? "columns-1 sm:columns-2 lg:columns-3" : "sm:grid-cols-2 lg:grid-cols-3"}`} variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {testimonials.map((t: any, i: number) => renderCard(t, i))}
            </motion.div>
          )
        ) : isPreview ? <p className="text-center opacity-40" style={{ color: siteStyles.textColor }}>Add testimonials</p> : null}
      </div>
    </section>
  )
}

export default Testimonials
