"use client"

import { useRef } from "react"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { ChevronDown } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

export function HeroFull({ config, content, siteStyles }: SectionProps) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 100])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  const heightClass = config.height === "full" ? "min-h-screen" : config.height === "large" ? "min-h-[80vh]" : "min-h-[60vh]"
  const alignClass = config.contentAlignment === "left" ? "text-left items-start" : config.contentAlignment === "right" ? "text-right items-end" : "text-center items-center"

  const title = content.title || "Welcome to Our Community"
  const words = title.split(" ")

  return (
    <section ref={ref} className={`relative ${heightClass} flex items-center justify-center overflow-hidden`}>
      {/* Background */}
      <motion.div className="absolute inset-0" style={{ scale: bgScale }}>
        {config.backgroundType === "image" && content.backgroundImage ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${content.backgroundImage})` }} />
        ) : config.backgroundType === "animated" ? (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${siteStyles.primaryColor}, ${siteStyles.secondaryColor})` }}>
            <motion.div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px]" style={{ backgroundColor: siteStyles.primaryColor, opacity: 0.3 }} animate={{ x: [0, 60, 0], y: [0, 40, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[100px]" style={{ backgroundColor: siteStyles.secondaryColor, opacity: 0.3 }} animate={{ x: [0, -50, 0], y: [0, 60, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${siteStyles.primaryColor}, ${siteStyles.secondaryColor})` }} />
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-black" style={{ opacity: (config.overlayOpacity || 40) / 100 }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: contentY, opacity: contentOpacity }} className={`relative z-10 container mx-auto px-4 flex flex-col ${alignClass} max-w-5xl`}>
        {/* Title — staggered word reveal */}
        <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
          {words.map((word: string, i: number) => (
            <motion.span key={i} className="inline-block mr-[0.3em]" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}>
              {i === Math.floor(words.length / 2) ? (
                <span style={{ color: siteStyles.primaryColor, filter: "brightness(1.3)" }}>{word}</span>
              ) : word}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        {content.subtitle && (
          <motion.p className="mt-6 text-base sm:text-lg lg:text-xl text-white/70 max-w-2xl leading-relaxed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}>
            {content.subtitle}
          </motion.p>
        )}

        {/* CTA Buttons */}
        {content.ctaButtons?.length > 0 && (
          <motion.div className="mt-8 flex flex-col sm:flex-row gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }}>
            {content.ctaButtons.map((btn: any, i: number) => (
              <Link key={i} href={btn.href || "#"} className={`px-8 py-3 rounded-xl font-medium text-base transition-all hover:scale-105 hover:shadow-lg ${btn.variant === "primary" ? "text-white shadow-md" : "border border-white/30 text-white hover:bg-white/10"}`}
                style={btn.variant === "primary" ? { backgroundColor: siteStyles.primaryColor } : {}}>
                {btn.text}
              </Link>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Scroll indicator */}
      {config.showScrollIndicator && (
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10" animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <ChevronDown className="h-6 w-6 text-white/50" />
        </motion.div>
      )}
    </section>
  )
}
