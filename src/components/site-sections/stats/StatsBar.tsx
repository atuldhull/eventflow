"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

function AnimatedStat({ value, suffix, delay }: { value: string; suffix: string; delay: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const numericValue = parseInt(value.replace(/[^0-9]/g, "")) || 0
  const hasK = value.toLowerCase().includes("k")

  return (
    <motion.span ref={ref} className="tabular-nums" initial={{ opacity: 0, scale: 0.5 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} transition={{ type: "spring", stiffness: 100, delay }}>
      {isInView ? (hasK ? value : numericValue.toLocaleString("en-IN")) : "0"}{suffix}
    </motion.span>
  )
}

export function StatsBar({ config, content, siteStyles }: SectionProps) {
  const stats: { value: string; label: string; suffix?: string }[] = content.stats || []
  const bg = config.background || "transparent"

  if (stats.length === 0) return null

  const bgStyles: Record<string, React.CSSProperties> = {
    transparent: { backgroundColor: siteStyles.backgroundColor },
    primary: { backgroundColor: siteStyles.primaryColor },
    dark: { backgroundColor: "#111827" },
    gradient: { background: `linear-gradient(135deg, ${siteStyles.primaryColor}, ${siteStyles.secondaryColor})` },
  }
  const isLight = bg === "transparent"
  const textColor = isLight ? siteStyles.textColor : "#FFFFFF"

  return (
    <section className="py-16 md:py-20" style={bgStyles[bg] || bgStyles.transparent}>
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-8 md:gap-0 md:divide-x" style={{ divideColor: textColor + "20" } as any}>
          {stats.map((stat, i) => (
            <motion.div key={i} className="flex-1 min-w-[140px] text-center px-4 md:px-8" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.5 }}>
              <p className="text-3xl sm:text-4xl md:text-5xl font-bold" style={{ color: textColor }}>
                <AnimatedStat value={stat.value} suffix={stat.suffix || ""} delay={i * 0.15} />
              </p>
              <p className="text-sm md:text-base mt-1 opacity-70" style={{ color: textColor }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default StatsBar
