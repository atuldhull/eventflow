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

// ── GALLERY SECTIONS ──

const galleryMasonry: SectionTypeDefinition = {
  id: "gallery-masonry", name: "Masonry Photo Gallery", description: "Pinterest-style masonry photo grid with lightbox", category: "gallery", icon: "Image",
  configSchema: { columns: { type: "select", label: "Columns", options: ["2", "3", "4"], default: "3" }, maxImages: { type: "number", label: "Max Images", min: 4, max: 24, default: 12 }, enableLightbox: { type: "boolean", label: "Enable Lightbox", default: true } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, images: { type: "image-list", label: "Images", max: 24, fields: ["url", "caption", "altText"] } },
  defaultConfig: { columns: "3", maxImages: 12, enableLightbox: true },
  defaultContent: { heading: "Gallery", images: [] },
}

const galleryCarousel: SectionTypeDefinition = {
  id: "gallery-carousel", name: "Photo Carousel", description: "Full-width image slideshow", category: "gallery", icon: "GalleryHorizontal",
  configSchema: { autoPlay: { type: "boolean", label: "Auto-play", default: true }, interval: { type: "number", label: "Interval (seconds)", min: 3, max: 15, default: 5 }, showCaptions: { type: "boolean", label: "Show Captions", default: true } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, images: { type: "image-list", label: "Images", max: 12, fields: ["url", "caption"] } },
  defaultConfig: { autoPlay: true, interval: 5, showCaptions: true },
  defaultContent: { heading: "Photo Highlights", images: [] },
}

// ── TEAM SECTION ──

const teamGrid: SectionTypeDefinition = {
  id: "team-grid", name: "Team Members", description: "Display team or club member profiles", category: "team", icon: "Users",
  configSchema: { columns: { type: "select", label: "Columns", options: ["2", "3", "4"], default: "3" }, cardStyle: { type: "select", label: "Card Style", options: ["circle-avatar", "square-avatar", "full-card"], default: "circle-avatar" }, showSocial: { type: "boolean", label: "Show Social Links", default: true } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, members: { type: "team-list", label: "Team Members", max: 20, fields: ["name", "role", "avatar", "bio", "linkedin", "twitter", "email"] } },
  defaultConfig: { columns: "3", cardStyle: "circle-avatar", showSocial: true },
  defaultContent: { heading: "Meet Our Team", members: [{ name: "Alex Johnson", role: "President", avatar: "" }, { name: "Priya Sharma", role: "Vice President", avatar: "" }, { name: "Rahul Mehta", role: "Event Coordinator", avatar: "" }] },
}

// ── SOCIAL SECTIONS ──

const testimonials: SectionTypeDefinition = {
  id: "testimonials", name: "Testimonials", description: "Member and attendee testimonials", category: "social", icon: "MessageCircle",
  configSchema: { layout: { type: "select", label: "Layout", options: ["carousel", "grid", "masonry"], default: "carousel" }, showRating: { type: "boolean", label: "Show Ratings", default: true }, autoRotate: { type: "boolean", label: "Auto-rotate (carousel)", default: true } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, testimonials: { type: "testimonial-list", label: "Testimonials", max: 10, fields: ["quote", "name", "role", "avatar", "rating"] } },
  defaultConfig: { layout: "carousel", showRating: true, autoRotate: true },
  defaultContent: { heading: "What People Say", testimonials: [{ quote: "An incredible experience that brought our community closer together.", name: "Anita Desai", role: "Community Member", rating: 5 }, { quote: "The best organized events I've ever attended. Highly recommended!", name: "Vikram Singh", role: "Regular Attendee", rating: 5 }] },
}

const socialFeed: SectionTypeDefinition = {
  id: "social-feed", name: "Social Media Feed", description: "Display social media posts or curated content", category: "social", icon: "Instagram",
  configSchema: { columns: { type: "select", label: "Columns", options: ["2", "3", "4"], default: "3" }, platform: { type: "select", label: "Platform", options: ["manual", "instagram", "twitter"], default: "manual" } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, posts: { type: "social-post-list", label: "Posts", max: 12, fields: ["image", "caption", "link"] }, profileLink: { type: "text", label: "Profile Link Text" } },
  defaultConfig: { columns: "3", platform: "manual" },
  defaultContent: { heading: "Follow Our Journey", posts: [], profileLink: "" },
}

// ── STATS SECTION ──

const statsBar: SectionTypeDefinition = {
  id: "stats-bar", name: "Statistics Bar", description: "Animated number counters showcasing key metrics", category: "stats", icon: "BarChart3",
  configSchema: { background: { type: "select", label: "Background", options: ["transparent", "primary", "dark", "gradient"], default: "dark" } },
  contentSchema: { stats: { type: "stats-list", label: "Statistics", max: 6, fields: ["value", "label", "suffix"] } },
  defaultConfig: { background: "dark" },
  defaultContent: { stats: [{ value: "500", label: "Members", suffix: "+" }, { value: "120", label: "Events Hosted", suffix: "" }, { value: "15", label: "Cities", suffix: "" }, { value: "98", label: "Satisfaction", suffix: "%" }] },
}

// ── CTA SECTION ──

const ctaBanner: SectionTypeDefinition = {
  id: "cta-banner", name: "Call to Action", description: "Full-width CTA banner driving users to take action", category: "cta", icon: "Megaphone",
  configSchema: { background: { type: "select", label: "Background", options: ["primary", "dark", "gradient", "image"], default: "gradient" } },
  contentSchema: { heading: { type: "text", label: "Heading", required: true }, subtitle: { type: "text", label: "Subtitle" }, ctaButtons: { type: "cta-buttons", label: "Buttons", max: 2 }, backgroundImage: { type: "image", label: "Background Image (for image bg)" } },
  defaultConfig: { background: "gradient" },
  defaultContent: { heading: "Ready to Join Us?", subtitle: "Sign up today and become part of our growing community", ctaButtons: [{ text: "Get Started", href: "/signup", variant: "primary" }] },
}

// ── CONTACT SECTION ──

const contactForm: SectionTypeDefinition = {
  id: "contact-form", name: "Contact Form", description: "Contact form with optional info and map", category: "contact", icon: "Mail",
  configSchema: { layout: { type: "select", label: "Layout", options: ["form-only", "form-info", "form-map"], default: "form-info" }, showSocial: { type: "boolean", label: "Show Social Links", default: true } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, email: { type: "text", label: "Contact Email" }, phone: { type: "text", label: "Contact Phone" }, address: { type: "textarea", label: "Address" }, mapUrl: { type: "url", label: "Google Maps Embed URL" }, socialLinks: { type: "social-links", label: "Social Links" } },
  defaultConfig: { layout: "form-info", showSocial: true },
  defaultContent: { heading: "Get in Touch", email: "hello@community.com", phone: "+91 98765 43210", address: "Mumbai, Maharashtra, India" },
}

// ── SPONSORS SECTION ──

const sponsorsGrid: SectionTypeDefinition = {
  id: "sponsors-grid", name: "Sponsors & Partners", description: "Display sponsor logos grouped by tier", category: "sponsors", icon: "Award",
  configSchema: { grouped: { type: "boolean", label: "Group by Tier", default: true }, logoSize: { type: "select", label: "Logo Size", options: ["small", "medium", "large"], default: "medium" } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, sponsors: { type: "sponsor-list", label: "Sponsors", max: 30, fields: ["name", "logo", "website", "tier"] } },
  defaultConfig: { grouped: true, logoSize: "medium" },
  defaultContent: { heading: "Our Sponsors & Partners", sponsors: [] },
}

// ── UTILITY SECTIONS ──

const faqSection: SectionTypeDefinition = {
  id: "faq", name: "FAQ", description: "Frequently asked questions with expandable answers", category: "utility", icon: "HelpCircle",
  configSchema: { style: { type: "select", label: "Style", options: ["accordion", "two-column", "cards"], default: "accordion" } },
  contentSchema: { heading: { type: "text", label: "Section Title" }, subtitle: { type: "text", label: "Subtitle" }, faqs: { type: "faq-list", label: "FAQs", max: 20, fields: ["question", "answer"] } },
  defaultConfig: { style: "accordion" },
  defaultContent: { heading: "Frequently Asked Questions", subtitle: "Can't find your answer? Contact us", faqs: [{ question: "How do I register for an event?", answer: "Visit the event page and click the Register button. Follow the steps to complete your registration." }, { question: "Can I get a refund?", answer: "Refund policies vary by event. Check the event's refund policy on its page for details." }, { question: "How do I contact the organizer?", answer: "Each event page has contact information for the organizer. You can also use the contact form on this page." }] },
}

const newsletter: SectionTypeDefinition = {
  id: "newsletter", name: "Newsletter Signup", description: "Email subscription form", category: "utility", icon: "Mail",
  configSchema: { layout: { type: "select", label: "Layout", options: ["inline", "card", "full-width"], default: "card" }, background: { type: "select", label: "Background", options: ["transparent", "primary", "dark"], default: "transparent" } },
  contentSchema: { heading: { type: "text", label: "Heading" }, subtitle: { type: "text", label: "Subtitle" }, placeholder: { type: "text", label: "Input Placeholder" }, buttonText: { type: "text", label: "Button Text" } },
  defaultConfig: { layout: "card", background: "transparent" },
  defaultContent: { heading: "Stay Updated", subtitle: "Subscribe to our newsletter for event updates", placeholder: "Enter your email", buttonText: "Subscribe" },
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
  "gallery-masonry": galleryMasonry,
  "gallery-carousel": galleryCarousel,
  "team-grid": teamGrid,
  "testimonials": testimonials,
  "social-feed": socialFeed,
  "stats-bar": statsBar,
  "cta-banner": ctaBanner,
  "contact-form": contactForm,
  "sponsors-grid": sponsorsGrid,
  "faq": faqSection,
  "newsletter": newsletter,
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
