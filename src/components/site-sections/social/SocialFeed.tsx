"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ExternalLink } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function SocialFeed({ config, content, siteStyles, isPreview }: SectionProps) {
  const posts: { image: string; caption?: string; link?: string }[] = content.posts || []
  const cols = parseInt(config.columns || "3")

  if (!isPreview && posts.length === 0) return null

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {content.heading && <motion.h2 className="text-2xl sm:text-3xl font-bold text-center mb-10" style={{ color: siteStyles.textColor }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{content.heading}</motion.h2>}

        {posts.length > 0 ? (
          <motion.div className={`grid gap-3 grid-cols-2 ${cols >= 3 ? "md:grid-cols-3" : ""} ${cols >= 4 ? "lg:grid-cols-4" : ""}`}
            variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {posts.map((post, i) => (
              <motion.a key={i} variants={item} href={post.link || "#"} target={post.link ? "_blank" : undefined} rel="noopener noreferrer" className="relative group aspect-square overflow-hidden" style={{ borderRadius: siteStyles.borderRadius }}>
                <Image src={post.image} alt={post.caption || `Post ${i + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes={`(max-width: 768px) 50vw, ${Math.floor(100 / cols)}vw`} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-center px-3">
                    {post.caption && <p className="text-xs line-clamp-3">{post.caption}</p>}
                    {post.link && <ExternalLink className="h-5 w-5 mx-auto mt-2" />}
                  </div>
                </div>
              </motion.a>
            ))}
          </motion.div>
        ) : isPreview ? <p className="text-center opacity-40" style={{ color: siteStyles.textColor }}>Add social media posts</p> : null}

        {content.profileLink && <p className="text-center mt-6 text-sm" style={{ color: siteStyles.primaryColor }}>{content.profileLink}</p>}
      </div>
    </section>
  )
}

export default SocialFeed
