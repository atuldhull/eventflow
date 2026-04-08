"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

export function HeroSplit({ config, content, siteStyles }: SectionProps) {
  const imageRight = config.imagePosition !== "left"

  const textBlock = (
    <motion.div className="flex-1 flex flex-col justify-center space-y-6" initial={{ opacity: 0, x: imageRight ? -40 : 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight" style={{ color: siteStyles.textColor }}>
        {content.title || "Building Community Through Events"}
      </h1>
      {content.subtitle && (
        <p className="text-base sm:text-lg leading-relaxed opacity-70" style={{ color: siteStyles.textColor }}>{content.subtitle}</p>
      )}
      {content.ctaButtons?.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2">
          {content.ctaButtons.map((btn: any, i: number) => (
            <Link key={i} href={btn.href || "#"} className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105 ${btn.variant === "primary" ? "text-white shadow-md" : "border"}`}
              style={btn.variant === "primary" ? { backgroundColor: siteStyles.primaryColor } : { borderColor: siteStyles.primaryColor, color: siteStyles.primaryColor }}>
              {btn.text}
            </Link>
          ))}
        </div>
      )}
      {config.showStats && content.stats?.length > 0 && (
        <motion.div className="flex gap-8 pt-4" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.5 }}>
          {content.stats.map((stat: any, i: number) => (
            <div key={i}>
              <motion.p className="text-2xl font-bold" style={{ color: siteStyles.primaryColor }} initial={{ scale: 0.5 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", delay: 0.4 + i * 0.1 }}>
                {stat.value}
              </motion.p>
              <p className="text-xs opacity-60" style={{ color: siteStyles.textColor }}>{stat.label}</p>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )

  const imageBlock = (
    <motion.div className="flex-1 relative" initial={{ opacity: 0, x: imageRight ? 40 : -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 }}>
      <div className="relative aspect-[4/3] overflow-hidden shadow-2xl" style={{ borderRadius: siteStyles.borderRadius }}>
        {content.image ? (
          <Image src={content.image} alt={content.title || ""} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${siteStyles.primaryColor}20, ${siteStyles.secondaryColor}20)` }} />
        )}
      </div>
    </motion.div>
  )

  return (
    <section className="min-h-[80vh] flex items-center" style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
          {imageRight ? <>{textBlock}{imageBlock}</> : <>{imageBlock}{textBlock}</>}
        </div>
      </div>
    </section>
  )
}
export default HeroSplit
