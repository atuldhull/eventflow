// ============================================================================
// TEMPLATE DEFINITIONS — Pre-built website configurations
// ============================================================================

import type { SectionConfig, SiteStyles } from "@/types/site-builder"

export interface TemplateDefinition {
  slug: string
  name: string
  description: string
  category: string
  tags: string[]
  requiredPlan: string
  isPremium: boolean
  isFeatured: boolean
  previewImages: string[]
  defaultSections: SectionConfig[]
  defaultStyles: SiteStyles
  supportedFeatures: string[]
}

// ============================================================================
// TEMPLATE 1: Sports Club Pro
// ============================================================================

const sportsClubPro: TemplateDefinition = {
  slug: "sports-club-pro",
  name: "Sports Club Pro",
  description: "Bold, energetic design for run clubs, gyms, sports teams, and fitness communities. Features dynamic layouts, athlete spotlights, and race/event tracking.",
  category: "SPORTS",
  tags: ["bold", "energetic", "dark-mode", "animated", "fitness"],
  requiredPlan: "FREE",
  isPremium: false,
  isFeatured: true,
  previewImages: [],
  defaultStyles: {
    primaryColor: "#FF4D00",
    secondaryColor: "#1A1A2E",
    accentColor: "#FFD700",
    backgroundColor: "#0F0F1A",
    textColor: "#F5F5F5",
    fontHeading: "'Space Grotesk', sans-serif",
    fontBody: "'Inter', sans-serif",
    borderRadius: "12px",
    buttonStyle: "rounded",
    navStyle: "transparent",
    footerStyle: "dark",
  },
  supportedFeatures: ["live-quiz", "live-poll", "countdown-timer", "leaderboard", "photo-gallery", "team-profiles", "event-calendar-widget", "weather-widget", "volunteer-signup", "merchandise-store"],
  defaultSections: [
    {
      id: "sec_sports_hero_0",
      type: "hero-full",
      enabled: true,
      order: 0,
      config: {
        backgroundType: "animated",
        height: "full",
        contentAlignment: "center",
        showScrollIndicator: true,
        overlayOpacity: 40,
      },
      content: {
        title: "Run Faster. Go Further. Together.",
        subtitle: "Join Mumbai's fastest-growing running community. Weekly runs, monthly races, and a family that pushes you forward.",
        ctaButtons: [
          { text: "Join the Club", href: "/register", variant: "primary" },
          { text: "Upcoming Runs", href: "#events", variant: "outline" },
        ],
      },
    },
    {
      id: "sec_sports_stats_1",
      type: "stats-bar",
      enabled: true,
      order: 1,
      config: {
        background: "primary",
      },
      content: {
        stats: [
          { value: "500", label: "Members", suffix: "+" },
          { value: "120", label: "Events", suffix: "" },
          { value: "15", label: "Cities", suffix: "" },
          { value: "4.8", label: "Rating", suffix: "/5" },
        ],
      },
    },
    {
      id: "sec_sports_events_2",
      type: "events-grid",
      enabled: true,
      order: 2,
      config: {
        columns: "3",
        maxEvents: 6,
        cardVariant: "default",
      },
      content: {
        heading: "Upcoming Runs & Events",
        emptyMessage: "No upcoming runs scheduled. Check back soon!",
        ctaText: "View Full Calendar",
      },
    },
    {
      id: "sec_sports_about_3",
      type: "about-simple",
      enabled: true,
      order: 3,
      config: {
        layout: "text-image",
        showDivider: false,
      },
      content: {
        heading: "About Our Club",
        body: "Founded in 2020, we started as a group of 5 friends who loved running together on Sunday mornings. Today, we're a 500+ member community spanning 15 cities. Whether you're training for your first 5K or your tenth marathon, you'll find your pace with us.",
        image: "",
      },
    },
    {
      id: "sec_sports_testimonials_4",
      type: "testimonials",
      enabled: true,
      order: 4,
      config: {
        layout: "carousel",
        showRating: true,
      },
      content: {
        heading: "What Our Runners Say",
        testimonials: [
          { quote: "This club changed my relationship with running. The coaches are incredible and the community keeps me motivated.", name: "Priya Sharma", role: "Marathon Runner", rating: 5 },
          { quote: "From couch to 10K in 3 months. I never thought I could do it, but the support here is unreal.", name: "Rahul Verma", role: "Beginner Runner", rating: 5 },
          { quote: "Best running community in Mumbai. The weekend long runs are my favourite part of the week.", name: "Anita Desai", role: "Ultra Runner", rating: 5 },
        ],
      },
    },
    {
      id: "sec_sports_gallery_5",
      type: "gallery-masonry",
      enabled: true,
      order: 5,
      config: {
        columns: "3",
        maxImages: 9,
      },
      content: {
        heading: "Moments from the Track",
        images: Array.from({ length: 9 }, (_, i) => ({ url: "", caption: `Race moment ${i + 1}`, alt: `Running photo ${i + 1}` })),
      },
    },
    {
      id: "sec_sports_cta_6",
      type: "cta-banner",
      enabled: true,
      order: 6,
      config: {
        background: "gradient",
      },
      content: {
        heading: "Ready to Start Running?",
        subtitle: "Your first group run is free. No experience needed.",
        ctaButtons: [
          { text: "Join Us Today", href: "/register", variant: "primary" },
        ],
      },
    },
    {
      id: "sec_sports_newsletter_7",
      type: "newsletter",
      enabled: true,
      order: 7,
      config: {
        layout: "full-width",
        background: "dark",
      },
      content: {
        heading: "Weekly Run Updates",
        subtitle: "Get route maps, training tips, and event alerts straight to your inbox",
      },
    },
  ],
}

// ============================================================================
// TEMPLATE 2: Tech Community Dark
// ============================================================================

const techCommunityDark: TemplateDefinition = {
  slug: "tech-community-dark",
  name: "Tech Community",
  description: "Modern, developer-friendly design for coding clubs, hackathon organizers, tech meetups, and developer communities. Clean code aesthetic with terminal-inspired elements.",
  category: "TECH",
  tags: ["modern", "dark-mode", "developer", "minimal", "code"],
  requiredPlan: "FREE",
  isPremium: false,
  isFeatured: true,
  previewImages: [],
  defaultStyles: {
    primaryColor: "#6C63FF",
    secondaryColor: "#00D9FF",
    accentColor: "#FF6B6B",
    backgroundColor: "#0D1117",
    textColor: "#E6EDF3",
    fontHeading: "'JetBrains Mono', monospace",
    fontBody: "'Inter', sans-serif",
    borderRadius: "8px",
    buttonStyle: "rounded",
    navStyle: "glass",
    footerStyle: "dark",
  },
  supportedFeatures: ["live-quiz", "live-poll", "countdown-timer", "leaderboard", "blog-posts", "photo-gallery", "team-profiles", "event-calendar-widget", "volunteer-signup"],
  defaultSections: [
    {
      id: "sec_tech_hero_0",
      type: "hero-split",
      enabled: true,
      order: 0,
      config: {
        imagePosition: "right",
        showStats: true,
        imageStyle: "rounded",
      },
      content: {
        title: "Build. Learn. Connect.",
        subtitle: "A community of developers, designers, and tech enthusiasts. Weekly workshops, monthly hackathons, and a Slack channel that never sleeps.",
        ctaButtons: [
          { text: "Join the Community", href: "/register", variant: "primary" },
          { text: "View Events", href: "#events", variant: "outline" },
        ],
        stats: [
          { value: "1200", label: "Members", suffix: "+" },
          { value: "80", label: "Workshops", suffix: "" },
          { value: "25", label: "Hackathons", suffix: "" },
        ],
        image: "",
      },
    },
    {
      id: "sec_tech_events_carousel_1",
      type: "events-carousel",
      enabled: true,
      order: 1,
      config: {
        maxEvents: 8,
        autoScroll: true,
      },
      content: {
        heading: "Upcoming Events & Workshops",
      },
    },
    {
      id: "sec_tech_mission_2",
      type: "mission-values",
      enabled: true,
      order: 2,
      config: {
        columns: "3",
        cardStyle: "glass",
      },
      content: {
        heading: "What We're About",
        missionText: "We believe technology is for everyone. Our mission is to create an inclusive space where developers of all levels can learn, build, and grow together.",
        values: [
          { icon: "Code", title: "Open Source First", description: "We contribute to and build with open-source tools" },
          { icon: "Users", title: "Community Driven", description: "Every decision is made by and for our members" },
          { icon: "Rocket", title: "Always Shipping", description: "We learn by building real projects that matter" },
          { icon: "Heart", title: "Inclusive by Design", description: "Everyone is welcome, regardless of experience level" },
        ],
      },
    },
    {
      id: "sec_tech_events_grid_3",
      type: "events-grid",
      enabled: true,
      order: 3,
      config: {
        columns: "3",
        maxEvents: 6,
        cardVariant: "default",
      },
      content: {
        heading: "All Events",
      },
    },
    {
      id: "sec_tech_team_4",
      type: "team-grid",
      enabled: true,
      order: 4,
      config: {
        columns: "4",
        cardStyle: "circle-avatar",
        showSocial: true,
      },
      content: {
        heading: "Core Team",
        members: [
          { name: "Alex Chen", role: "Community Lead", bio: "Full-stack dev, open source contributor" },
          { name: "Maya Patel", role: "Events Manager", bio: "Hackathon organizer, DevRel" },
          { name: "Sam Wilson", role: "Tech Lead", bio: "Systems engineer, Rust enthusiast" },
          { name: "Zara Ahmed", role: "Design Lead", bio: "UI/UX designer, accessibility advocate" },
        ],
      },
    },
    {
      id: "sec_tech_faq_5",
      type: "faq",
      enabled: true,
      order: 5,
      config: {
        style: "accordion",
      },
      content: {
        heading: "Frequently Asked Questions",
        faqs: [
          { question: "Do I need coding experience to join?", answer: "Not at all! We have events for absolute beginners as well as advanced developers. Everyone starts somewhere." },
          { question: "Are events free?", answer: "Most of our workshops and meetups are free. Hackathons may have a small registration fee to cover food and prizes." },
          { question: "How do I propose a talk or workshop?", answer: "Fill out our speaker proposal form! We're always looking for community members to share their knowledge." },
          { question: "Is there an online community?", answer: "Yes! We have an active Slack workspace and Discord server. Join after registering." },
        ],
      },
    },
    {
      id: "sec_tech_sponsors_6",
      type: "sponsors-grid",
      enabled: true,
      order: 6,
      config: {
        grouped: true,
      },
      content: {
        heading: "Our Partners",
        sponsors: [],
      },
    },
    {
      id: "sec_tech_contact_7",
      type: "contact-form",
      enabled: true,
      order: 7,
      config: {
        layout: "form-info",
        showMap: false,
      },
      content: {
        heading: "Get in Touch",
        email: "hello@techcommunity.dev",
      },
    },
  ],
}

// ============================================================================
// TEMPLATE 3: Corporate Elegance
// ============================================================================

const corporateElegance: TemplateDefinition = {
  slug: "corporate-elegance",
  name: "Corporate Elegance",
  description: "Professional, clean design for companies, conferences, and business events. Conveys trust, competence, and sophistication. Light theme with crisp typography.",
  category: "CORPORATE",
  tags: ["professional", "clean", "light", "corporate", "formal"],
  requiredPlan: "STARTER",
  isPremium: false,
  isFeatured: true,
  previewImages: [],
  defaultStyles: {
    primaryColor: "#1E40AF",
    secondaryColor: "#1E293B",
    accentColor: "#F59E0B",
    backgroundColor: "#FFFFFF",
    textColor: "#1E293B",
    fontHeading: "'Plus Jakarta Sans', sans-serif",
    fontBody: "'Inter', sans-serif",
    borderRadius: "6px",
    buttonStyle: "rounded",
    navStyle: "solid",
    footerStyle: "dark",
  },
  supportedFeatures: ["countdown-timer", "blog-posts", "sponsor-showcase", "team-profiles", "event-calendar-widget", "volunteer-signup"],
  defaultSections: [
    {
      id: "sec_corp_hero_0",
      type: "hero-full",
      enabled: true,
      order: 0,
      config: {
        backgroundType: "image",
        height: "large",
        overlayOpacity: 50,
        contentAlignment: "left",
        showScrollIndicator: true,
      },
      content: {
        title: "Elevating Corporate Events",
        subtitle: "Professional event management for forward-thinking organizations. From intimate workshops to large-scale conferences.",
        ctaButtons: [
          { text: "View Our Events", href: "#events", variant: "primary" },
          { text: "Contact Us", href: "#contact", variant: "outline" },
        ],
        backgroundImage: "",
      },
    },
    {
      id: "sec_corp_about_1",
      type: "about-simple",
      enabled: true,
      order: 1,
      config: {
        layout: "text-image",
        showDivider: false,
      },
      content: {
        heading: "Who We Are",
        body: "We are a leading corporate events management company with over a decade of experience creating impactful business experiences. Our team specializes in conferences, leadership summits, training workshops, and team-building events.",
        image: "",
      },
    },
    {
      id: "sec_corp_stats_2",
      type: "stats-bar",
      enabled: true,
      order: 2,
      config: {
        background: "primary",
      },
      content: {
        stats: [
          { value: "200", label: "Events Delivered", suffix: "+" },
          { value: "50", label: "Corporate Clients", suffix: "+" },
          { value: "25000", label: "Attendees Served", suffix: "+" },
          { value: "98", label: "Satisfaction Rate", suffix: "%" },
        ],
      },
    },
    {
      id: "sec_corp_events_3",
      type: "events-grid",
      enabled: true,
      order: 3,
      config: {
        columns: "3",
        maxEvents: 6,
        cardVariant: "default",
      },
      content: {
        heading: "Upcoming Events",
      },
    },
    {
      id: "sec_corp_testimonials_4",
      type: "testimonials",
      enabled: true,
      order: 4,
      config: {
        layout: "grid",
        showRating: false,
      },
      content: {
        heading: "Client Testimonials",
        testimonials: [
          { quote: "Flawless execution from start to finish. Our annual conference was the best one yet thanks to this team.", name: "Rajesh Gupta", role: "VP, TechCorp India" },
          { quote: "Professional, organized, and always one step ahead. Highly recommended for any corporate event.", name: "Dr. Sunita Rao", role: "Director, Innovation Labs" },
          { quote: "They transformed our company offsite into an unforgettable experience. Every detail was perfect.", name: "Arjun Mehra", role: "CEO, StartupXYZ" },
        ],
      },
    },
    {
      id: "sec_corp_sponsors_5",
      type: "sponsors-grid",
      enabled: true,
      order: 5,
      config: {
        grouped: true,
      },
      content: {
        heading: "Trusted By",
        sponsors: [],
      },
    },
    {
      id: "sec_corp_contact_6",
      type: "contact-form",
      enabled: true,
      order: 6,
      config: {
        layout: "form-info",
        showMap: false,
      },
      content: {
        heading: "Let's Plan Your Next Event",
      },
    },
    {
      id: "sec_corp_newsletter_7",
      type: "newsletter",
      enabled: true,
      order: 7,
      config: {
        layout: "card",
        background: "transparent",
      },
      content: {
        heading: "Stay Informed",
        subtitle: "Subscribe for event updates and industry insights",
      },
    },
  ],
}

// ============================================================================
// TEMPLATE 4: Minimal Zen
// ============================================================================

const minimalZen: TemplateDefinition = {
  slug: "minimal-zen",
  name: "Minimal Zen",
  description: "Ultra-clean, content-focused design with generous whitespace. Perfect for organizations that want their content to speak without visual noise. Less is more.",
  category: "MINIMAL",
  tags: ["minimal", "clean", "whitespace", "elegant", "simple"],
  requiredPlan: "FREE",
  isPremium: false,
  isFeatured: false,
  previewImages: [],
  defaultStyles: {
    primaryColor: "#111111",
    secondaryColor: "#666666",
    accentColor: "#E11D48",
    backgroundColor: "#FAFAFA",
    textColor: "#111111",
    fontHeading: "'Playfair Display', serif",
    fontBody: "'Source Sans 3', sans-serif",
    borderRadius: "2px",
    buttonStyle: "square",
    navStyle: "solid",
    footerStyle: "light",
  },
  supportedFeatures: ["photo-gallery", "blog-posts", "event-calendar-widget"],
  defaultSections: [
    {
      id: "sec_zen_hero_0",
      type: "hero-split",
      enabled: true,
      order: 0,
      config: {
        imagePosition: "right",
        showStats: false,
        imageStyle: "square",
      },
      content: {
        title: "Simply Beautiful Events",
        subtitle: "We create thoughtful experiences with attention to every detail.",
        ctaButtons: [
          { text: "Explore Events", href: "#events", variant: "primary" },
        ],
        image: "",
      },
    },
    {
      id: "sec_zen_events_1",
      type: "events-grid",
      enabled: true,
      order: 1,
      config: {
        columns: "2",
        maxEvents: 4,
        cardVariant: "minimal",
      },
      content: {
        heading: "Events",
      },
    },
    {
      id: "sec_zen_about_2",
      type: "about-simple",
      enabled: true,
      order: 2,
      config: {
        layout: "text-only",
        showDivider: false,
      },
      content: {
        heading: "About",
        body: "We believe in the power of intentional gatherings. Every event we create is designed to be meaningful, purposeful, and memorable. No clutter, no excess \u2014 just the essence of human connection.",
      },
    },
    {
      id: "sec_zen_gallery_3",
      type: "gallery-carousel",
      enabled: true,
      order: 3,
      config: {
        showCaptions: false,
      },
      content: {
        heading: "",
        images: Array.from({ length: 6 }, (_, i) => ({ url: "", caption: "", alt: `Gallery image ${i + 1}` })),
      },
    },
    {
      id: "sec_zen_contact_4",
      type: "contact-form",
      enabled: true,
      order: 4,
      config: {
        layout: "form-only",
        showMap: false,
      },
      content: {
        heading: "Say Hello",
      },
    },
  ],
}

// ============================================================================
// TEMPLATE 5: Festival Vibes
// ============================================================================

const festivalVibes: TemplateDefinition = {
  slug: "festival-vibes",
  name: "Festival Vibes",
  description: "Vibrant, colorful design for cultural festivals, music events, college fests, and creative gatherings. Packed with energy, gradients, and playful animations.",
  category: "CREATIVE",
  tags: ["colorful", "vibrant", "festival", "animated", "playful", "college"],
  requiredPlan: "FREE",
  isPremium: false,
  isFeatured: true,
  previewImages: [],
  defaultStyles: {
    primaryColor: "#8B5CF6",
    secondaryColor: "#EC4899",
    accentColor: "#06B6D4",
    backgroundColor: "#0F0518",
    textColor: "#F5F3FF",
    fontHeading: "'Clash Display', sans-serif",
    fontBody: "'DM Sans', sans-serif",
    borderRadius: "16px",
    buttonStyle: "pill",
    navStyle: "transparent",
    footerStyle: "dark",
  },
  supportedFeatures: ["live-quiz", "live-poll", "countdown-timer", "leaderboard", "photo-gallery", "blog-posts", "sponsor-showcase", "team-profiles", "event-calendar-widget", "volunteer-signup", "merchandise-store"],
  defaultSections: [
    {
      id: "sec_fest_hero_0",
      type: "hero-video",
      enabled: true,
      order: 0,
      config: {
        autoplay: true,
        muted: true,
        loop: true,
        overlayOpacity: 50,
        showControls: true,
      },
      content: {
        title: "The Biggest Fest of the Year",
        subtitle: "3 Days. 50+ Events. 10,000 Participants. One Unforgettable Experience.",
        ctaButtons: [
          { text: "Get Your Pass", href: "/register", variant: "primary" },
          { text: "View Schedule", href: "#schedule", variant: "outline" },
        ],
        videoUrl: "",
        fallbackImage: "",
      },
    },
    {
      id: "sec_fest_stats_1",
      type: "stats-bar",
      enabled: true,
      order: 1,
      config: {
        background: "gradient",
      },
      content: {
        stats: [
          { value: "50", label: "Events", suffix: "+" },
          { value: "10000", label: "Participants", suffix: "+" },
          { value: "3", label: "Days", suffix: "" },
          { value: "100", label: "Artists", suffix: "+" },
        ],
      },
    },
    {
      id: "sec_fest_timeline_2",
      type: "events-timeline",
      enabled: true,
      order: 2,
      config: {
        groupByMonth: false,
        showDates: true,
      },
      content: {
        heading: "Event Schedule",
      },
    },
    {
      id: "sec_fest_gallery_3",
      type: "gallery-masonry",
      enabled: true,
      order: 3,
      config: {
        columns: "4",
        maxImages: 12,
      },
      content: {
        heading: "Last Year's Highlights",
        images: Array.from({ length: 12 }, (_, i) => ({ url: "", caption: `Festival moment ${i + 1}`, alt: `Festival photo ${i + 1}` })),
      },
    },
    {
      id: "sec_fest_team_4",
      type: "team-grid",
      enabled: true,
      order: 4,
      config: {
        columns: "4",
        cardStyle: "full-card",
        showSocial: false,
      },
      content: {
        heading: "Organizing Committee",
        members: [],
      },
    },
    {
      id: "sec_fest_sponsors_5",
      type: "sponsors-grid",
      enabled: true,
      order: 5,
      config: {
        grouped: true,
      },
      content: {
        heading: "Our Sponsors",
        sponsors: [],
      },
    },
    {
      id: "sec_fest_faq_6",
      type: "faq",
      enabled: true,
      order: 6,
      config: {
        style: "cards",
      },
      content: {
        heading: "Everything You Need to Know",
        faqs: [
          { question: "When and where is the fest?", answer: "The fest runs from April 15-17, 2026 at the Main Campus. Events are spread across 5 venues." },
          { question: "How do I register?", answer: "Click 'Get Your Pass' above! You can register for individual events or get an all-access pass." },
          { question: "Can I participate from other colleges?", answer: "Absolutely! The fest is open to students from all colleges and universities." },
          { question: "Is there parking available?", answer: "Yes, free parking is available at Gate 2. We recommend carpooling or using public transport." },
        ],
      },
    },
    {
      id: "sec_fest_cta_7",
      type: "cta-banner",
      enabled: true,
      order: 7,
      config: {
        background: "gradient",
      },
      content: {
        heading: "Don't Miss Out!",
        subtitle: "Early bird passes are selling fast. Grab yours before they're gone.",
        ctaButtons: [
          { text: "Register Now", href: "/register", variant: "primary" },
        ],
      },
    },
  ],
}

// ============================================================================
// TEMPLATE 6: Education Hub
// ============================================================================

const educationHub: TemplateDefinition = {
  slug: "education-hub",
  name: "Education Hub",
  description: "Warm, inviting design for universities, colleges, departments, and academic organizations. Balanced between professional and approachable. Supports course-style event listings.",
  category: "EDUCATION",
  tags: ["academic", "warm", "approachable", "education", "university"],
  requiredPlan: "FREE",
  isPremium: false,
  isFeatured: false,
  previewImages: [],
  defaultStyles: {
    primaryColor: "#0F766E",
    secondaryColor: "#1E293B",
    accentColor: "#F97316",
    backgroundColor: "#FFFFFF",
    textColor: "#1E293B",
    fontHeading: "'Outfit', sans-serif",
    fontBody: "'Nunito', sans-serif",
    borderRadius: "10px",
    buttonStyle: "rounded",
    navStyle: "solid",
    footerStyle: "dark",
  },
  supportedFeatures: ["live-quiz", "live-poll", "countdown-timer", "blog-posts", "photo-gallery", "team-profiles", "event-calendar-widget", "volunteer-signup"],
  defaultSections: [
    {
      id: "sec_edu_hero_0",
      type: "hero-full",
      enabled: true,
      order: 0,
      config: {
        backgroundType: "image",
        height: "large",
        overlayOpacity: 45,
        contentAlignment: "center",
        showScrollIndicator: true,
      },
      content: {
        title: "Learn, Grow, and Excel",
        subtitle: "Workshops, seminars, and hands-on sessions designed to expand your knowledge and skills.",
        ctaButtons: [
          { text: "Browse Workshops", href: "#events", variant: "primary" },
          { text: "About Us", href: "#about", variant: "outline" },
        ],
        backgroundImage: "",
      },
    },
    {
      id: "sec_edu_events_1",
      type: "events-grid",
      enabled: true,
      order: 1,
      config: {
        columns: "3",
        maxEvents: 6,
        cardVariant: "default",
      },
      content: {
        heading: "Upcoming Workshops & Seminars",
      },
    },
    {
      id: "sec_edu_about_2",
      type: "about-simple",
      enabled: true,
      order: 2,
      config: {
        layout: "image-text",
        showDivider: false,
      },
      content: {
        heading: "About Our Department",
        body: "We are committed to providing high-quality learning experiences that bridge the gap between theory and practice. Our workshops and seminars are led by industry experts and experienced faculty members.",
        image: "",
      },
    },
    {
      id: "sec_edu_mission_3",
      type: "mission-values",
      enabled: true,
      order: 3,
      config: {
        columns: "3",
        cardStyle: "bordered",
      },
      content: {
        heading: "Our Approach",
        missionText: "Education is not just about knowledge \u2014 it's about transformation.",
        values: [
          { icon: "BookOpen", title: "Research-Driven", description: "Our curriculum is informed by the latest research and industry trends" },
          { icon: "Users", title: "Collaborative", description: "Learn alongside peers from diverse backgrounds and disciplines" },
          { icon: "Target", title: "Practical", description: "Every session includes hands-on exercises and real-world applications" },
        ],
      },
    },
    {
      id: "sec_edu_team_4",
      type: "team-grid",
      enabled: true,
      order: 4,
      config: {
        columns: "3",
        cardStyle: "full-card",
        showSocial: true,
      },
      content: {
        heading: "Our Faculty & Mentors",
        members: [],
      },
    },
    {
      id: "sec_edu_testimonials_5",
      type: "testimonials",
      enabled: true,
      order: 5,
      config: {
        layout: "carousel",
        showRating: true,
      },
      content: {
        heading: "Student Feedback",
        testimonials: [
          { quote: "The workshop on data science completely changed my career trajectory. The hands-on projects were invaluable.", name: "Kavitha Nair", role: "M.Tech Student", rating: 5 },
          { quote: "Excellent faculty who actually care about student learning. The mentorship goes beyond the classroom.", name: "Rohan Kapoor", role: "Final Year, CS", rating: 5 },
          { quote: "Practical, well-structured sessions that are directly applicable to real-world problems.", name: "Fatima Sheikh", role: "Research Scholar", rating: 5 },
        ],
      },
    },
    {
      id: "sec_edu_faq_6",
      type: "faq",
      enabled: true,
      order: 6,
      config: {
        style: "accordion",
      },
      content: {
        heading: "Common Questions",
        faqs: [
          { question: "Who can attend the workshops?", answer: "Our workshops are open to all students, faculty, and professionals. Some advanced sessions may have prerequisites listed in the event description." },
          { question: "Are certificates provided?", answer: "Yes, certificates of completion are issued for all paid workshops and multi-day programs." },
          { question: "Can I get academic credits?", answer: "Select workshops are eligible for academic credit. Check individual event listings for details." },
          { question: "How do I register?", answer: "Click on any event and follow the registration process. Early registration is recommended as seats are limited." },
        ],
      },
    },
    {
      id: "sec_edu_contact_7",
      type: "contact-form",
      enabled: true,
      order: 7,
      config: {
        layout: "form-info",
        showMap: false,
      },
      content: {
        heading: "Contact Us",
      },
    },
  ],
}

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

export const TEMPLATES: Record<string, TemplateDefinition> = {
  "sports-club-pro": sportsClubPro,
  "tech-community-dark": techCommunityDark,
  "corporate-elegance": corporateElegance,
  "minimal-zen": minimalZen,
  "festival-vibes": festivalVibes,
  "education-hub": educationHub,
}

export function getTemplate(slug: string): TemplateDefinition | undefined {
  return TEMPLATES[slug]
}

export function getTemplatesByCategory(category: string): TemplateDefinition[] {
  return Object.values(TEMPLATES).filter((t) => t.category === category)
}

export function getFeaturedTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATES).filter((t) => t.isFeatured)
}

export function getAllTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATES)
}

export function getTemplateCategories(): { id: string; name: string; count: number }[] {
  const categoryMap = new Map<string, number>()
  for (const t of Object.values(TEMPLATES)) {
    categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1)
  }
  const categoryNames: Record<string, string> = {
    SPORTS: "Sports & Fitness",
    TECH: "Tech & Developer",
    CORPORATE: "Corporate & Business",
    MINIMAL: "Minimal & Clean",
    CREATIVE: "Creative & Arts",
    EDUCATION: "Education & Academic",
  }
  return Array.from(categoryMap.entries()).map(([id, count]) => ({
    id,
    name: categoryNames[id] || id,
    count,
  }))
}
