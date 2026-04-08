"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const tierOrder = ["TITLE", "PLATINUM", "GOLD", "SILVER", "BRONZE", "PARTNER", "MEDIA"]
const tierLabels: Record<string, string> = { TITLE: "Title Sponsors", PLATINUM: "Platinum", GOLD: "Gold", SILVER: "Silver", BRONZE: "Bronze", PARTNER: "Partners", MEDIA: "Media Partners" }
const tierSizes: Record<string, string> = { TITLE: "h-20 w-48", PLATINUM: "h-16 w-40", GOLD: "h-14 w-36", SILVER: "h-12 w-28", BRONZE: "h-12 w-28", PARTNER: "h-10 w-24", MEDIA: "h-10 w-24" }

export function SponsorsGrid({ config, content, siteStyles, isPreview }: SectionProps) {
  const sponsors: any[] = content.sponsors || []

  if (!isPreview && sponsors.length === 0) return null

  const grouped: Record<string, any[]> = {}
  if (config.grouped !== false) {
    sponsors.forEach((s) => { const tier = s.tier || "PARTNER"; if (!grouped[tier]) grouped[tier] = []; grouped[tier].push(s) })
  }

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{content.heading}</motion.h2>}

        {sponsors.length > 0 ? (
          config.grouped !== false ? (
            <div className="space-y-10">
              {tierOrder.filter((t) => grouped[t]?.length).map((tier) => (
                <div key={tier}>
                  <p className="text-xs font-medium uppercase tracking-wider text-center mb-4 opacity-40" style={{ color: siteStyles.textColor }}>{tierLabels[tier]}</p>
                  <motion.div className="flex flex-wrap justify-center items-center gap-6 md:gap-8" variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    {grouped[tier].map((s: any, i: number) => (
                      <motion.a key={i} variants={item} href={s.website || "#"} target="_blank" rel="noopener noreferrer" className={`${tierSizes[tier] || "h-12 w-28"} relative grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-105`}>
                        {s.logo ? <Image src={s.logo} alt={s.name} fill className="object-contain" /> : <div className="w-full h-full flex items-center justify-center text-xs font-medium opacity-40" style={{ color: siteStyles.textColor }}>{s.name}</div>}
                      </motion.a>
                    ))}
                  </motion.div>
                </div>
              ))}
            </div>
          ) : (
            <motion.div className="flex flex-wrap justify-center items-center gap-8" variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {sponsors.map((s: any, i: number) => (
                <motion.a key={i} variants={item} href={s.website || "#"} target="_blank" rel="noopener noreferrer" className="h-14 w-32 relative grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-105">
                  {s.logo ? <Image src={s.logo} alt={s.name} fill className="object-contain" /> : <span className="text-xs opacity-40" style={{ color: siteStyles.textColor }}>{s.name}</span>}
                </motion.a>
              ))}
            </motion.div>
          )
        ) : isPreview ? <p className="text-center opacity-40" style={{ color: siteStyles.textColor }}>Add sponsors and partners</p> : null}
      </div>
    </section>
  )
}

export default SponsorsGrid
