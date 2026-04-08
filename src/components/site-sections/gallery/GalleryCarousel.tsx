"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

export function GalleryCarousel({ config, content, siteStyles, isPreview }: SectionProps) {
  const images: { url: string; caption?: string }[] = content.images || []
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), [images.length])
  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), [images.length])

  useEffect(() => {
    if (!config.autoPlay || images.length <= 1) return
    const timer = setInterval(next, (config.interval || 5) * 1000)
    return () => clearInterval(timer)
  }, [config.autoPlay, config.interval, images.length, next])

  if (!isPreview && images.length === 0) return null

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-8" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{content.heading}</motion.h2>}

        {images.length > 0 ? (
          <div className="relative rounded-2xl overflow-hidden group" style={{ borderRadius: siteStyles.borderRadius }}>
            <div className="relative h-[250px] md:h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div key={current} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                  <Image src={images[current].url} alt={images[current].caption || `Slide ${current + 1}`} fill className="object-cover" sizes="100vw" />
                  {config.showCaptions && images[current].caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/60 to-transparent">
                      <p className="text-white text-sm">{images[current].caption}</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {images.length > 1 && <>
              <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50 hidden md:block"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50 hidden md:block"><ChevronRight className="h-5 w-5" /></button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-white" : "w-2 bg-white/50"}`} />)}
              </div>
            </>}
          </div>
        ) : isPreview ? <p className="text-center opacity-40" style={{ color: siteStyles.textColor }}>Add images to your carousel</p> : null}
      </div>
    </section>
  )
}

export default GalleryCarousel
