"use client"

import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import type { SectionConfig, SiteStyles } from "@/types/site-builder"

export interface SectionProps {
  config: Record<string, any>
  content: Record<string, any>
  siteStyles: SiteStyles
  orgSlug?: string
  isPreview?: boolean
}

// Dynamic imports for code-splitting — each section loads only when needed
const COMPONENT_MAP: Record<string, React.ComponentType<SectionProps>> = {
  "hero-full": dynamic(() => import("@/components/site-sections/heroes/HeroFull")),
  "hero-split": dynamic(() => import("@/components/site-sections/heroes/HeroSplit")),
  "hero-video": dynamic(() => import("@/components/site-sections/heroes/HeroVideo")),
  "about-simple": dynamic(() => import("@/components/site-sections/about/AboutSimple")),
  "mission-values": dynamic(() => import("@/components/site-sections/about/MissionValues")),
  "events-grid": dynamic(() => import("@/components/site-sections/events/EventsGrid")),
  "events-carousel": dynamic(() => import("@/components/site-sections/events/EventsCarousel")),
  "events-timeline": dynamic(() => import("@/components/site-sections/events/EventsTimeline")),
  "gallery-masonry": dynamic(() => import("@/components/site-sections/gallery/GalleryMasonry")),
  "gallery-carousel": dynamic(() => import("@/components/site-sections/gallery/GalleryCarousel")),
  "team-grid": dynamic(() => import("@/components/site-sections/team/TeamGrid")),
  "testimonials": dynamic(() => import("@/components/site-sections/social/Testimonials")),
  "social-feed": dynamic(() => import("@/components/site-sections/social/SocialFeed")),
  "stats-bar": dynamic(() => import("@/components/site-sections/stats/StatsBar")),
  "cta-banner": dynamic(() => import("@/components/site-sections/cta/CTABanner")),
  "contact-form": dynamic(() => import("@/components/site-sections/contact/ContactForm")),
  "sponsors-grid": dynamic(() => import("@/components/site-sections/sponsors/SponsorsGrid")),
  "faq": dynamic(() => import("@/components/site-sections/utility/FAQSection")),
  "newsletter": dynamic(() => import("@/components/site-sections/utility/Newsletter")),
}

const isHeroSection = (type: string) => type.startsWith("hero")

interface SectionRendererProps {
  section: SectionConfig
  siteStyles: SiteStyles
  orgSlug?: string
  isPreview?: boolean
}

export function SectionRenderer({ section, siteStyles, orgSlug, isPreview }: SectionRendererProps) {
  if (!section.enabled) return null
  const Component = COMPONENT_MAP[section.type]
  if (!Component) return null
  return (
    <motion.div id={section.id} data-section-type={section.type} className={isHeroSection(section.type) ? "" : "py-16 md:py-24"}
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5 }}>
      <Component config={section.config} content={section.content} siteStyles={siteStyles} orgSlug={orgSlug} isPreview={isPreview} />
    </motion.div>
  )
}

interface SectionListProps {
  sections: SectionConfig[]
  siteStyles: SiteStyles
  orgSlug?: string
  isPreview?: boolean
}

export function SectionList({ sections, siteStyles, orgSlug, isPreview }: SectionListProps) {
  const sorted = [...sections].filter((s) => s.enabled).sort((a, b) => a.order - b.order)
  return <div>{sorted.map((section) => <SectionRenderer key={section.id} section={section} siteStyles={siteStyles} orgSlug={orgSlug} isPreview={isPreview} />)}</div>
}
