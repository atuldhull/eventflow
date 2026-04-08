"use client"

import { motion } from "framer-motion"
import * as LucideIcons from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }

function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = (LucideIcons as any)[name] || LucideIcons.Star
  return <Icon className={className} style={style} />
}

export function MissionValues({ config, content, siteStyles }: SectionProps) {
  const cols = parseInt(config.columns || "3")
  const cardStyle = config.cardStyle || "elevated"
  const values = content.values || []

  const cardClasses: Record<string, string> = {
    flat: "",
    bordered: "border",
    elevated: "bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl",
    glass: "bg-white/10 backdrop-blur-md border border-white/20",
  }

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {/* Heading */}
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          {content.heading && (
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold" style={{ color: siteStyles.textColor }}>{content.heading}</h2>
          )}
        </motion.div>

        {/* Mission statement */}
        {content.missionText && (
          <motion.div className="max-w-3xl mx-auto text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}>
            <div className="relative py-8 px-6 rounded-2xl" style={{ backgroundColor: siteStyles.primaryColor + "08" }}>
              <span className="absolute top-2 left-6 text-5xl font-serif opacity-20" style={{ color: siteStyles.primaryColor }}>&ldquo;</span>
              <p className="text-lg sm:text-xl italic leading-relaxed opacity-80" style={{ color: siteStyles.textColor }}>
                {content.missionText}
              </p>
              <span className="absolute bottom-2 right-6 text-5xl font-serif opacity-20" style={{ color: siteStyles.primaryColor }}>&rdquo;</span>
            </div>
          </motion.div>
        )}

        {/* Value cards */}
        {values.length > 0 && (
          <motion.div
            className={`grid gap-6 ${cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
            variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            {values.map((val: any, i: number) => (
              <motion.div key={i} variants={item} className={`p-6 rounded-2xl text-center transition-all duration-300 hover:-translate-y-1 ${cardClasses[cardStyle] || cardClasses.elevated}`} style={{ borderRadius: siteStyles.borderRadius }}>
                <motion.div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4" style={{ backgroundColor: siteStyles.primaryColor + "15" }} whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: "spring" }}>
                  <DynamicIcon name={val.icon || "Star"} className="h-7 w-7" style={{ color: siteStyles.primaryColor }} />
                </motion.div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: siteStyles.textColor }}>{val.title}</h3>
                <p className="text-sm leading-relaxed opacity-60" style={{ color: siteStyles.textColor }}>{val.description}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}
