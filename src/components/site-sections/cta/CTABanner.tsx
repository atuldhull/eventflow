"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import type { SectionProps } from "@/lib/site-builder/section-renderer"
import { SECTION_DARK_BG } from "@/lib/site-builder/section-constants"

export function CTABanner({ config, content, siteStyles }: SectionProps) {
  const bg = config.background || "primary"
  const bgStyles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: siteStyles.primaryColor },
    dark: { backgroundColor: SECTION_DARK_BG },
    gradient: { background: `linear-gradient(135deg, ${siteStyles.primaryColor}, ${siteStyles.secondaryColor})` },
    image: { backgroundImage: content.backgroundImage ? `url(${content.backgroundImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center" },
  }

  return (
    <section className="relative py-16 md:py-24 overflow-hidden" style={bgStyles[bg] || bgStyles.primary}>
      {bg === "image" && <div className="absolute inset-0 bg-black/50" />}
      {/* Decorative dots */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]" />

      <motion.div className="relative z-10 container mx-auto px-4 text-center max-w-3xl"
        initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">{content.heading || "Ready to Get Started?"}</h2>
        {content.subtitle && <p className="mt-4 text-base sm:text-lg text-white/80">{content.subtitle}</p>}
        {content.ctaButtons?.length > 0 && (
          <motion.div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            {content.ctaButtons.map((btn: any, i: number) => (
              <motion.div key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Link href={btn.href || "#"} className={`inline-flex items-center justify-center px-8 py-3 rounded-xl font-medium transition-all ${btn.variant === "primary" ? "bg-white shadow-xl hover:shadow-2xl" : "border-2 border-white/30 text-white hover:bg-white/10"}`}
                  style={btn.variant === "primary" ? { color: siteStyles.primaryColor } : {}}>
                  {btn.text}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}

export default CTABanner
