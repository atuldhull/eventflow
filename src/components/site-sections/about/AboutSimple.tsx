"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

export function AboutSimple({ config, content, siteStyles }: SectionProps) {
  const layout = config.layout || "text-image"
  const hasImage = content.image && layout !== "text-only"
  const imageFirst = layout === "image-text"

  const textBlock = (
    <motion.div className={hasImage ? "flex-1" : "max-w-3xl mx-auto"} initial={{ opacity: 0, x: hasImage ? (imageFirst ? 30 : -30) : 0, y: hasImage ? 0 : 20 }} whileInView={{ opacity: 1, x: 0, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold" style={{ color: siteStyles.textColor }}>
        {content.heading || "About Us"}
      </h2>
      <div className="mt-2 h-1 w-16 rounded-full" style={{ backgroundColor: siteStyles.primaryColor }} />
      <div className="mt-6 text-base sm:text-lg leading-relaxed space-y-4 opacity-80" style={{ color: siteStyles.textColor }}>
        {(content.body || "").split("\n").map((p: string, i: number) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </motion.div>
  )

  const imageBlock = hasImage ? (
    <motion.div className="flex-1" initial={{ opacity: 0, x: imageFirst ? -30 : 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}>
      <div className="relative aspect-[4/3] overflow-hidden shadow-xl" style={{ borderRadius: siteStyles.borderRadius }}>
        <Image src={content.image} alt={content.heading || "About"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 40vw" />
      </div>
    </motion.div>
  ) : null

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      {config.showDivider && <div className="border-t" style={{ borderColor: siteStyles.primaryColor + "20" }} />}
      <div className="container mx-auto px-4">
        {hasImage ? (
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            {imageFirst ? <>{imageBlock}{textBlock}</> : <>{textBlock}{imageBlock}</>}
          </div>
        ) : (
          <div className="text-center">{textBlock}</div>
        )}
      </div>
    </section>
  )
}
