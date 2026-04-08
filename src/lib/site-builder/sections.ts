// ============================================================================
// SECTION TYPE REGISTRY — Single source of truth for all section types
// ============================================================================

export interface ConfigField {
  type: "select" | "boolean" | "number" | "slider" | "color" | "text"
  label: string
  options?: string[]
  min?: number
  max?: number
  default: any
  description?: string
}

export interface ContentField {
  type: "text" | "textarea" | "richtext" | "image" | "url" | "color" | "cta-buttons" | "stats-list" | "card-list" | "team-list" | "testimonial-list" | "image-list" | "faq-list" | "sponsor-list" | "social-links" | "social-post-list"
  label: string
  placeholder?: string
  required?: boolean
  max?: number
  default?: any
  fields?: string[]
}

export interface SectionTypeDefinition {
  id: string
  name: string
  description: string
  category: "hero" | "about" | "events" | "team" | "gallery" | "social" | "stats" | "cta" | "contact" | "sponsors" | "utility"
  icon: string
  configSchema: Record<string, ConfigField>
  contentSchema: Record<string, ContentField>
  defaultConfig: Record<string, any>
  defaultContent: Record<string, any>
}

// ── SECTION DEFINITIONS ──

const heroFull: SectionTypeDefinition = {
  id: "hero-full",
  name: "Full-Screen Hero",
  description: "Impactful full-viewport hero with background, overlay, and animated content",
  category: "hero",
  icon: "Monitor",
  configSchema: {
    backgroundType: { type: "select", label: "Background Type", options: ["gradient", "image", "video", "animated"], default: "gradient" },
    overlayOpacity: { type: "slider", label: "Overlay Opacity", min: 0, max: 100, default: 40 },
    contentAlignment: { type: "select", label: "Content Alignment", options: ["center", "left", "right"], default: "center" },
    height: { type: "select", label: "Height", options: ["full", "large", "medium"], default: "full" },
    showScrollIndicator: { type: "boolean", label: "Show Scroll Indicator", default: true },
  },
  contentSchema: {
    title: { type: "text", label: "Title", required: true, placeholder: "Your main headline" },
    subtitle: { type: "textarea", label: "Subtitle", placeholder: "Supporting text" },
    backgroundImage: { type: "image", label: "Background Image" },
    backgroundVideo: { type: "url", label: "Background Video URL" },
    ctaButtons: { type: "cta-buttons", label: "CTA Buttons", max: 3 },
  },
  defaultConfig: { backgroundType: "gradient", overlayOpacity: 40, contentAlignment: "center", height: "full", showScrollIndicator: true },
  defaultContent: {
    title: "Welcome to Our Community",
    subtitle: "Join thousands of members in creating unforgettable experiences together",
    ctaButtons: [
      { text: "Explore Events", href: "/events", variant: "primary" },
      { text: "Join Us", href: "/register", variant: "outline" },
    ],
  },
}

const heroSplit: SectionTypeDefinition = {
  id: "hero-split",
  name: "Split Layout Hero",
  description: "Two-column hero with text on one side and an image on the other",
  category: "hero",
  icon: "Columns",
  configSchema: {
    imagePosition: { type: "select", label: "Image Position", options: ["left", "right"], default: "right" },
    showStats: { type: "boolean", label: "Show Stats Row", default: true },
    imageStyle: { type: "select", label: "Image Style", options: ["rounded", "square", "circle-crop"], default: "rounded" },
  },
  contentSchema: {
    title: { type: "text", label: "Title", required: true },
    subtitle: { type: "textarea", label: "Subtitle" },
    image: { type: "image", label: "Hero Image", required: true },
    ctaButtons: { type: "cta-buttons", label: "CTA Buttons", max: 2 },
    stats: { type: "stats-list", label: "Stats", max: 4, fields: ["value", "label"] },
  },
  defaultConfig: { imagePosition: "right", showStats: true, imageStyle: "rounded" },
  defaultContent: {
    title: "Building Community Through Events",
    subtitle: "We bring people together through workshops, meetups, and experiences that matter.",
    image: "",
    ctaButtons: [{ text: "View Events", href: "/events", variant: "primary" }],
    stats: [
      { value: "500+", label: "Members" },
      { value: "120", label: "Events" },
      { value: "15", label: "Cities" },
    ],
  },
}

const heroVideo: SectionTypeDefinition = {
  id: "hero-video",
  name: "Video Background Hero",
  description: "Hero with autoplay video background for maximum visual impact",
  category: "hero",
  icon: "Play",
  configSchema: {
    autoplay: { type: "boolean", label: "Autoplay", default: true },
    muted: { type: "boolean", label: "Start Muted", default: true },
    loop: { type: "boolean", label: "Loop Video", default: true },
    overlayOpacity: { type: "slider", label: "Overlay Opacity", min: 20, max: 80, default: 50 },
    showControls: { type: "boolean", label: "Show Play/Pause", default: true },
  },
  contentSchema: {
    title: { type: "text", label: "Title", required: true },
    subtitle: { type: "textarea", label: "Subtitle" },
    videoUrl: { type: "url", label: "Video URL", required: true },
    fallbackImage: { type: "image", label: "Fallback Image (Mobile)" },
    ctaButtons: { type: "cta-buttons", label: "CTA Buttons", max: 2 },
  },
  defaultConfig: { autoplay: true, muted: true, loop: true, overlayOpacity: 50, showControls: true },
  defaultContent: {
    title: "Experience Something Extraordinary",
    subtitle: "Watch our community in action and join the movement",
    videoUrl: "",
    fallbackImage: "",
    ctaButtons: [{ text: "Get Started", href: "/signup", variant: "primary" }],
  },
}

const aboutSimple: SectionTypeDefinition = {
  id: "about-simple",
  name: "Simple About",
  description: "Clean about section with text and optional image",
  category: "about",
  icon: "FileText",
  configSchema: {
    layout: { type: "select", label: "Layout", options: ["text-only", "text-image", "image-text"], default: "text-image" },
    showDivider: { type: "boolean", label: "Show Top Divider", default: false },
  },
  contentSchema: {
    heading: { type: "text", label: "Heading", required: true },
    body: { type: "richtext", label: "Body Text", required: true },
    image: { type: "image", label: "Image" },
  },
  defaultConfig: { layout: "text-image", showDivider: false },
  defaultContent: {
    heading: "About Us",
    body: "We are a passionate community dedicated to bringing people together through amazing events. Founded with the belief that shared experiences create lasting connections, we organize workshops, meetups, and celebrations that inspire and unite.",
    image: "",
  },
}

const missionValues: SectionTypeDefinition = {
  id: "mission-values",
  name: "Mission & Values",
  description: "Mission statement with a grid of value cards",
  category: "about",
  icon: "Target",
  configSchema: {
    columns: { type: "select", label: "Columns", options: ["2", "3", "4"], default: "3" },
    cardStyle: { type: "select", label: "Card Style", options: ["flat", "bordered", "elevated", "glass"], default: "elevated" },
  },
  contentSchema: {
    heading: { type: "text", label: "Section Title" },
    missionText: { type: "textarea", label: "Mission Statement", required: true },
    values: { type: "card-list", label: "Values", max: 6, fields: ["icon", "title", "description"] },
  },
  defaultConfig: { columns: "3", cardStyle: "elevated" },
  defaultContent: {
    heading: "Our Mission & Values",
    missionText: "To create meaningful connections through shared experiences that inspire growth, foster community, and celebrate excellence.",
    values: [
      { icon: "Heart", title: "Community", description: "Building strong bonds through shared passions" },
      { icon: "Star", title: "Excellence", description: "Striving for the highest quality in every event" },
      { icon: "Lightbulb", title: "Innovation", description: "Embracing new ideas and creative approaches" },
      { icon: "Users", title: "Inclusivity", description: "Welcoming everyone regardless of background" },
    ],
  },
}

const eventsGrid: SectionTypeDefinition = {
  id: "events-grid",
  name: "Events Grid",
  description: "Auto-populated grid of upcoming events from your organization",
  category: "events",
  icon: "LayoutGrid",
  configSchema: {
    maxEvents: { type: "number", label: "Max Events", min: 2, max: 12, default: 6 },
    columns: { type: "select", label: "Columns", options: ["2", "3", "4"], default: "3" },
    cardVariant: { type: "select", label: "Card Style", options: ["default", "compact", "featured", "minimal"], default: "default" },
    autoFetch: { type: "boolean", label: "Auto-fetch from API", default: true, description: "Automatically loads your published events" },
  },
  contentSchema: {
    heading: { type: "text", label: "Section Title" },
    subtitle: { type: "text", label: "Subtitle" },
    emptyMessage: { type: "text", label: "Empty State Message" },
    ctaText: { type: "text", label: "View All Button Text" },
    ctaHref: { type: "url", label: "View All Link" },
  },
  defaultConfig: { maxEvents: 6, columns: "3", cardVariant: "default", autoFetch: true },
  defaultContent: {
    heading: "Upcoming Events",
    subtitle: "Don't miss out on what's coming next",
    emptyMessage: "No upcoming events right now. Check back soon!",
    ctaText: "View All Events",
    ctaHref: "/events",
  },
}

const eventsCarousel: SectionTypeDefinition = {
  id: "events-carousel",
  name: "Events Carousel",
  description: "Horizontal scrolling event showcase",
  category: "events",
  icon: "GalleryHorizontal",
  configSchema: {
    maxEvents: { type: "number", label: "Max Events", min: 3, max: 12, default: 8 },
    autoScroll: { type: "boolean", label: "Auto-scroll", default: true },
    scrollInterval: { type: "number", label: "Scroll Interval (seconds)", min: 3, max: 15, default: 5 },
  },
  contentSchema: {
    heading: { type: "text", label: "Section Title" },
  },
  defaultConfig: { maxEvents: 8, autoScroll: true, scrollInterval: 5 },
  defaultContent: { heading: "Featured Events" },
}

const eventsTimeline: SectionTypeDefinition = {
  id: "events-timeline",
  name: "Events Timeline",
  description: "Vertical timeline showing events chronologically",
  category: "events",
  icon: "GitBranch",
  configSchema: {
    maxEvents: { type: "number", label: "Max Events", min: 3, max: 20, default: 10 },
    groupByMonth: { type: "boolean", label: "Group by Month", default: true },
    showDates: { type: "boolean", label: "Show Full Dates", default: true },
  },
  contentSchema: {
    heading: { type: "text", label: "Section Title" },
    subtitle: { type: "text", label: "Subtitle" },
  },
  defaultConfig: { maxEvents: 10, groupByMonth: true, showDates: true },
  defaultContent: { heading: "Event Timeline", subtitle: "What's happening and when" },
}

// ── REGISTRY ──

export const SECTION_REGISTRY: Record<string, SectionTypeDefinition> = {
  "hero-full": heroFull,
  "hero-split": heroSplit,
  "hero-video": heroVideo,
  "about-simple": aboutSimple,
  "mission-values": missionValues,
  "events-grid": eventsGrid,
  "events-carousel": eventsCarousel,
  "events-timeline": eventsTimeline,
}

export function getSectionDefinition(type: string): SectionTypeDefinition | undefined {
  return SECTION_REGISTRY[type]
}

export function getSectionsByCategory(category: string): SectionTypeDefinition[] {
  return Object.values(SECTION_REGISTRY).filter((s) => s.category === category)
}

export function getAllSectionCategories(): { id: string; name: string; icon: string }[] {
  return [
    { id: "hero", name: "Hero Sections", icon: "Monitor" },
    { id: "about", name: "About & Info", icon: "FileText" },
    { id: "events", name: "Events", icon: "Calendar" },
    { id: "team", name: "Team", icon: "Users" },
    { id: "gallery", name: "Gallery", icon: "Image" },
    { id: "social", name: "Social Proof", icon: "MessageCircle" },
    { id: "stats", name: "Statistics", icon: "BarChart3" },
    { id: "cta", name: "Call to Action", icon: "Megaphone" },
    { id: "contact", name: "Contact", icon: "Mail" },
    { id: "sponsors", name: "Sponsors", icon: "Award" },
    { id: "utility", name: "Utility", icon: "Settings" },
  ]
}
