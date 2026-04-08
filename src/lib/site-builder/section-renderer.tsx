"use client"

import { motion } from "framer-motion"
import type { SectionConfig, SiteStyles } from "@/types/site-builder"
import { HeroFull } from "@/components/site-sections/heroes/HeroFull"
import { HeroSplit } from "@/components/site-sections/heroes/HeroSplit"
import { HeroVideo } from "@/components/site-sections/heroes/HeroVideo"
import { AboutSimple } from "@/components/site-sections/about/AboutSimple"
import { MissionValues } from "@/components/site-sections/about/MissionValues"
import { EventsGrid } from "@/components/site-sections/events/EventsGrid"
import { EventsCarousel } from "@/components/site-sections/events/EventsCarousel"
import { EventsTimeline } from "@/components/site-sections/events/EventsTimeline"

export interface SectionProps {
  config: Record<string, any>
  content: Record<string, any>
  siteStyles: SiteStyles
  orgSlug?: string
  isPreview?: boolean
}

const COMPONENT_MAP: Record<string, React.ComponentType<SectionProps>> = {
  "hero-full": HeroFull,
  "hero-split": HeroSplit,
  "hero-video": HeroVideo,
  "about-simple": AboutSimple,
  "mission-values": MissionValues,
  "events-grid": EventsGrid,
  "events-carousel": EventsCarousel,
  "events-timeline": EventsTimeline,
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

  const isHero = isHeroSection(section.type)

  return (
    <motion.div
      id={section.id}
      data-section-type={section.type}
      className={isHero ? "" : "py-16 md:py-24"}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
    >
      <Component
        config={section.config}
        content={section.content}
        siteStyles={siteStyles}
        orgSlug={orgSlug}
        isPreview={isPreview}
      />
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

  return (
    <div>
      {sorted.map((section) => (
        <SectionRenderer key={section.id} section={section} siteStyles={siteStyles} orgSlug={orgSlug} isPreview={isPreview} />
      ))}
    </div>
  )
}
