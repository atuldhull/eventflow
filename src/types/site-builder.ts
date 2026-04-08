// ============================================================================
// SITE BUILDER TYPES
// TypeScript types matching the JSON structures used in SiteConfig,
// SiteTemplate, FeatureModule, and related models.
// ============================================================================

// ── Section Types ──

export interface SectionConfig {
  id: string
  type: string
  enabled: boolean
  order: number
  config: Record<string, any>
  content: Record<string, any>
}

export interface CTAButton {
  text: string
  href: string
  variant: "primary" | "secondary" | "outline" | "ghost"
  external?: boolean
}

export interface StatItem {
  value: string
  label: string
  suffix?: string
}

export interface TeamMemberItem {
  name: string
  role: string
  avatar?: string
  bio?: string
  linkedin?: string
  twitter?: string
  email?: string
}

export interface TestimonialItem {
  quote: string
  name: string
  role?: string
  avatar?: string
  rating?: number
}

export interface SponsorItem {
  name: string
  logo: string
  website?: string
  tier: "TITLE" | "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "PARTNER" | "MEDIA"
}

export interface FAQItem {
  question: string
  answer: string
}

export interface NavItem {
  label: string
  href: string
  order: number
  external?: boolean
  icon?: string
}

export interface FooterColumn {
  title: string
  links: { label: string; href: string }[]
}

export interface FooterConfig {
  columns: FooterColumn[]
  copyright: string
  showPoweredBy: boolean
  socialLinks?: Record<string, string>
}

// ── Style Types ──

export interface SiteStyles {
  primaryColor: string
  secondaryColor: string
  accentColor?: string
  backgroundColor: string
  textColor: string
  fontHeading: string
  fontBody: string
  borderRadius: string
  buttonStyle: "rounded" | "pill" | "square"
  navStyle: "transparent" | "solid" | "glass"
  footerStyle: "light" | "dark" | "colored"
}

// ── Feature Module Types ──

export interface EnabledFeature {
  moduleId: string
  enabled: boolean
  config: Record<string, any>
  placement?: string
}

export interface FeatureConfigField {
  type: "string" | "number" | "boolean" | "select" | "color" | "image" | "url"
  title: string
  description?: string
  default?: any
  minimum?: number
  maximum?: number
  options?: string[]
  required?: boolean
}

export interface FeatureConfigSchema {
  type: "object"
  properties: Record<string, FeatureConfigField>
  required?: string[]
}

// ── Site Config Types ──

export interface SiteConfigData {
  siteName: string
  tagline?: string
  siteDescription?: string
  favicon?: string
  ogImage?: string
  sections: SectionConfig[]
  styles: SiteStyles
  customCss?: string
  navigation?: NavItem[]
  footer?: FooterConfig
  enabledFeatures: EnabledFeature[]
  content?: Record<string, any>
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string[]
  isPublished: boolean
}

// ── Template Categories ──

export interface TemplateCategory {
  id: string
  name: string
  description: string
  icon: string
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: "SPORTS", name: "Sports & Fitness", description: "Run clubs, gyms, sports teams", icon: "Trophy" },
  { id: "TECH", name: "Tech & Developer", description: "Coding clubs, hackathons, tech meetups", icon: "Code" },
  { id: "CORPORATE", name: "Corporate & Business", description: "Company events, conferences", icon: "Building2" },
  { id: "COMMUNITY", name: "Community & Social", description: "Meetups, volunteer groups, NGOs", icon: "Users" },
  { id: "EDUCATION", name: "Education & Academic", description: "Universities, colleges, schools", icon: "GraduationCap" },
  { id: "CREATIVE", name: "Creative & Arts", description: "Art, music, photography, design", icon: "Palette" },
  { id: "MINIMAL", name: "Minimal & Clean", description: "Simple, elegant, content-focused", icon: "Minus" },
  { id: "PREMIUM", name: "Premium & Luxury", description: "High-end events, galas, exclusive", icon: "Crown" },
]

// ── Module Categories ──

export const MODULE_CATEGORIES = [
  { id: "ENGAGEMENT", name: "Engagement", icon: "Zap", description: "Interactive features to boost participation" },
  { id: "CONTENT", name: "Content", icon: "FileText", description: "Display and manage content" },
  { id: "SOCIAL", name: "Social", icon: "MessageCircle", description: "Community and communication tools" },
  { id: "ANALYTICS", name: "Analytics", icon: "BarChart3", description: "Data and insights widgets" },
  { id: "COMMERCE", name: "Commerce", icon: "ShoppingBag", description: "Sell products and accept donations" },
  { id: "UTILITY", name: "Utility", icon: "Settings", description: "Helpful tools and information" },
  { id: "SCHEDULING", name: "Scheduling", icon: "Calendar", description: "Schedule and speaker management" },
  { id: "GAMIFICATION", name: "Gamification", icon: "Gamepad2", description: "Points, badges, and leaderboards" },
] as const

export type ModuleCategory = typeof MODULE_CATEGORIES[number]["id"]
