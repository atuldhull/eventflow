"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

interface GalleryImage { url: string; caption?: string; altText?: string }

function Lightbox({ images, index, onClose, onNext, onPrev }: { images: GalleryImage[]; index: number; onClose: () => void; onNext: () => void; onPrev: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") onNext(); if (e.key === "ArrowLeft") onPrev() }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKey)
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handleKey) }
  }, [onClose, onNext, onPrev])

  const img = images[index]
  if (!img) return null

  return createPortal(
    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-label="Image lightbox">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-6 w-6" /></button>
      {images.length > 1 && <>
        <button onClick={onPrev} className="absolute left-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
        <button onClick={onNext} className="absolute right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
      </>}
      <AnimatePresence mode="wait">
        <motion.div key={index} className="relative max-w-[90vw] max-h-[85vh]" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
          <Image src={img.url} alt={img.altText || img.caption || ""} width={1200} height={800} className="max-h-[85vh] w-auto object-contain rounded-lg" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-6 left-0 right-0 text-center text-white">
        {img.caption && <p className="text-sm mb-1">{img.caption}</p>}
        <p className="text-xs opacity-50">{index + 1} / {images.length}</p>
      </div>
    </motion.div>,
    document.body
  )
}

export function GalleryMasonry({ config, content, siteStyles, isPreview }: SectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const images: GalleryImage[] = content.images || []
  const displayed = images.slice(0, config.maxImages || 12)
  const cols = parseInt(config.columns || "3")

  const next = useCallback(() => setLightboxIndex((i) => i !== null ? (i + 1) % displayed.length : null), [displayed.length])
  const prev = useCallback(() => setLightboxIndex((i) => i !== null ? (i - 1 + displayed.length) % displayed.length : null), [displayed.length])

  if (!isPreview && displayed.length === 0) return null

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && (
          <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-10" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            {content.heading}
          </motion.h2>
        )}
        {displayed.length > 0 ? (
          <div className={`columns-2 ${cols >= 3 ? "md:columns-3" : ""} ${cols >= 4 ? "lg:columns-4" : ""} gap-4`}>
            {displayed.map((img, i) => (
              <motion.div key={i} className="mb-4 break-inside-avoid group cursor-zoom-in relative overflow-hidden" style={{ borderRadius: siteStyles.borderRadius }}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                onClick={() => config.enableLightbox !== false && setLightboxIndex(i)}>
                <Image src={img.url} alt={img.altText || img.caption || `Photo ${i + 1}`} width={600} height={400 + (i % 3) * 100} className="w-full h-auto object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {img.caption && <p className="absolute bottom-0 left-0 right-0 p-3 text-white text-sm bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">{img.caption}</p>}
              </motion.div>
            ))}
          </div>
        ) : isPreview ? (
          <p className="text-center opacity-40" style={{ color: siteStyles.textColor }}>Add images to your gallery</p>
        ) : null}
        {images.length > (config.maxImages || 12) && (
          <p className="text-center mt-6 text-sm" style={{ color: siteStyles.primaryColor }}>View All {images.length} Photos</p>
        )}
      </div>
      <AnimatePresence>
        {lightboxIndex !== null && <Lightbox images={displayed} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNext={next} onPrev={prev} />}
      </AnimatePresence>
    </section>
  )
}

export default GalleryMasonry
