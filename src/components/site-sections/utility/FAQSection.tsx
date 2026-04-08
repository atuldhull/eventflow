"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function FAQSection({ config, content, siteStyles, isPreview }: SectionProps) {
  const faqs: { question: string; answer: string }[] = content.faqs || []
  const style = config.style || "accordion"
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!isPreview && faqs.length === 0) return null

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-4" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{content.heading}</motion.h2>}
        {content.subtitle && <p className="text-center opacity-60 mb-10" style={{ color: siteStyles.textColor }}>{content.subtitle}</p>}

        {faqs.length > 0 ? (
          style === "accordion" ? (
            <motion.div className="max-w-2xl mx-auto divide-y" style={{ divideColor: siteStyles.textColor + "10" } as any} variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {faqs.map((faq, i) => (
                <motion.div key={i} variants={item}>
                  <button onClick={() => toggle(i)} className="w-full flex items-center justify-between py-5 text-left gap-4">
                    <span className="font-medium text-sm sm:text-base" style={{ color: siteStyles.textColor }}>{faq.question}</span>
                    <motion.div animate={{ rotate: openIndex === i ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="h-5 w-5 shrink-0 opacity-40" style={{ color: siteStyles.textColor }} /></motion.div>
                  </button>
                  <AnimatePresence>
                    {openIndex === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <p className="pb-5 text-sm leading-relaxed opacity-70" style={{ color: siteStyles.textColor }}>{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          ) : style === "two-column" ? (
            <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
              {faqs.map((faq, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                  <h3 className="font-medium mb-2" style={{ color: siteStyles.textColor }}>{faq.question}</h3>
                  <p className="text-sm opacity-60 leading-relaxed" style={{ color: siteStyles.textColor }}>{faq.answer}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto" variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {faqs.map((faq, i) => (
                <motion.div key={i} variants={item} className="p-5 rounded-2xl border" style={{ borderColor: siteStyles.textColor + "10", borderRadius: siteStyles.borderRadius }}>
                  <h3 className="font-medium mb-2 text-sm" style={{ color: siteStyles.textColor }}>{faq.question}</h3>
                  <p className="text-sm opacity-60 leading-relaxed" style={{ color: siteStyles.textColor }}>{faq.answer}</p>
                </motion.div>
              ))}
            </motion.div>
          )
        ) : isPreview ? <p className="text-center opacity-40" style={{ color: siteStyles.textColor }}>Add FAQ items</p> : null}
      </div>
    </section>
  )
}

export default FAQSection
