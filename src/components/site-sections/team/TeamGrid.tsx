"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ExternalLink, Globe, Mail } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }

function Initials({ name, color }: { name: string; color: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  return <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: color + "80" }}>{initials}</div>
}

export function TeamGrid({ config, content, siteStyles, isPreview }: SectionProps) {
  const members: any[] = content.members || []
  const cols = parseInt(config.columns || "3")
  const cardStyle = config.cardStyle || "circle-avatar"

  if (!isPreview && members.length === 0) return null

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{content.heading}</motion.h2>}

        {members.length > 0 ? (
          <motion.div className={`grid gap-8 ${cols === 4 ? "grid-cols-2 lg:grid-cols-4" : cols === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}
            variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {members.map((member: any, i: number) => (
              <motion.div key={i} variants={item} className={`text-center ${cardStyle === "full-card" ? "bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl rounded-2xl p-6 transition-all hover:-translate-y-1" : ""}`} style={cardStyle === "full-card" ? { borderRadius: siteStyles.borderRadius } : {}}>
                <motion.div className={`mx-auto mb-4 overflow-hidden ${cardStyle === "square-avatar" ? "aspect-square" : "rounded-full"} ${cardStyle === "full-card" ? "w-20 h-20 rounded-full" : "w-28 h-28 sm:w-32 sm:h-32"}`}
                  style={cardStyle === "square-avatar" ? { borderRadius: siteStyles.borderRadius } : {}} whileHover={{ scale: 1.05 }}>
                  {member.avatar ? <Image src={member.avatar} alt={member.name} width={128} height={128} className="w-full h-full object-cover" /> : <Initials name={member.name} color={siteStyles.primaryColor} />}
                </motion.div>
                <h3 className="font-semibold" style={{ color: siteStyles.textColor }}>{member.name}</h3>
                <p className="text-sm mt-0.5" style={{ color: siteStyles.primaryColor }}>{member.role}</p>
                {cardStyle === "full-card" && member.bio && <p className="text-sm mt-2 line-clamp-3 opacity-60" style={{ color: siteStyles.textColor }}>{member.bio}</p>}
                {config.showSocial && (
                  <div className="flex justify-center gap-3 mt-3">
                    {member.linkedin && <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-100 transition-opacity" style={{ color: siteStyles.primaryColor }}><ExternalLink className="h-4 w-4" /></a>}
                    {member.twitter && <a href={member.twitter} target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-100 transition-opacity" style={{ color: siteStyles.primaryColor }}><Globe className="h-4 w-4" /></a>}
                    {member.email && <a href={`mailto:${member.email}`} className="opacity-40 hover:opacity-100 transition-opacity" style={{ color: siteStyles.primaryColor }}><Mail className="h-4 w-4" /></a>}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : isPreview ? <p className="text-center opacity-40" style={{ color: siteStyles.textColor }}>Add team members</p> : null}
      </div>
    </section>
  )
}

export default TeamGrid
