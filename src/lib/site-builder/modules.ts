// ============================================================================
// FEATURE MODULE REGISTRY — Plug-and-play interactive capabilities
// ============================================================================

export interface ModuleDefinition {
  moduleId: string
  name: string
  description: string
  shortDescription: string
  icon: string
  category: string
  componentName: string
  adminComponentName?: string
  hasAdminPanel: boolean
  configSchema: Record<string, any>
  defaultConfig: Record<string, any>
  dataTypes: string[]
  requiredPlan: string
  supportedPlacements: string[]
  incompatibleWith: string[]
  isPremium: boolean
  isBeta: boolean
  tags: string[]
}

const liveQuiz: ModuleDefinition = {
  moduleId: "live-quiz", name: "Live Quiz", icon: "HelpCircle", category: "ENGAGEMENT",
  description: "Create interactive quizzes for your audience. Participants answer questions in real-time, earn points, and compete on a leaderboard.",
  shortDescription: "Engage your audience with interactive quizzes",
  componentName: "LiveQuizModule", adminComponentName: "LiveQuizAdmin", hasAdminPanel: true,
  configSchema: {
    maxQuestions: { type: "number", min: 1, max: 50, default: 10 },
    timePerQuestion: { type: "number", min: 5, max: 120, default: 30 },
    showLeaderboard: { type: "boolean", default: true },
    allowRetakes: { type: "boolean", default: false },
    shuffleQuestions: { type: "boolean", default: true },
    shuffleOptions: { type: "boolean", default: true },
    showCorrectAnswer: { type: "boolean", default: true },
    pointsPerCorrect: { type: "number", min: 1, max: 100, default: 10 },
    bonusForSpeed: { type: "boolean", default: true },
    requireLogin: { type: "boolean", default: true },
  },
  defaultConfig: { maxQuestions: 10, timePerQuestion: 30, showLeaderboard: true, allowRetakes: false, shuffleQuestions: true, shuffleOptions: true, showCorrectAnswer: true, pointsPerCorrect: 10, bonusForSpeed: true, requireLogin: true },
  dataTypes: ["quiz_definition", "quiz_response", "quiz_result"],
  requiredPlan: "STARTER", supportedPlacements: ["page-section", "standalone-page", "event-page-addon"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["engagement", "gamification", "interactive"],
}

const livePoll: ModuleDefinition = {
  moduleId: "live-poll", name: "Live Poll", icon: "BarChart2", category: "ENGAGEMENT",
  description: "Run real-time polls and surveys during events or on your website. See results update live as participants vote.",
  shortDescription: "Real-time polls with live results",
  componentName: "LivePollModule", adminComponentName: "LivePollAdmin", hasAdminPanel: true,
  configSchema: {
    allowMultipleVotes: { type: "boolean", default: false },
    showResults: { type: "select", options: ["always", "after-vote", "after-close"], default: "after-vote" },
    resultDisplay: { type: "select", options: ["bar-chart", "pie-chart", "percentage"], default: "bar-chart" },
    anonymous: { type: "boolean", default: false },
    requireLogin: { type: "boolean", default: true },
    autoClose: { type: "boolean", default: false },
    closeAt: { type: "datetime", optional: true },
  },
  defaultConfig: { allowMultipleVotes: false, showResults: "after-vote", resultDisplay: "bar-chart", anonymous: false, requireLogin: true, autoClose: false },
  dataTypes: ["poll_definition", "poll_vote"],
  requiredPlan: "FREE", supportedPlacements: ["page-section", "sidebar-widget", "floating-widget", "event-page-addon"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["engagement", "voting", "feedback"],
}

const countdownTimer: ModuleDefinition = {
  moduleId: "countdown-timer", name: "Countdown Timer", icon: "Timer", category: "ENGAGEMENT",
  description: "Display a beautiful countdown timer to your next event or important date. Builds anticipation and urgency.",
  shortDescription: "Build anticipation with countdown timers",
  componentName: "CountdownTimerModule", hasAdminPanel: false,
  configSchema: {
    style: { type: "select", options: ["flip", "minimal", "bold", "circular"], default: "flip" },
    showDays: { type: "boolean", default: true }, showHours: { type: "boolean", default: true },
    showMinutes: { type: "boolean", default: true }, showSeconds: { type: "boolean", default: true },
    showLabels: { type: "boolean", default: true },
    size: { type: "select", options: ["small", "medium", "large"], default: "medium" },
    targetType: { type: "select", options: ["next-event", "custom-date"], default: "next-event" },
    completionMessage: { type: "text", default: "The wait is over!" },
    completionAction: { type: "select", options: ["show-message", "redirect", "hide"], default: "show-message" },
    customDate: { type: "datetime", optional: true },
    redirectUrl: { type: "url", optional: true },
  },
  defaultConfig: { style: "flip", showDays: true, showHours: true, showMinutes: true, showSeconds: true, showLabels: true, size: "medium", targetType: "next-event", completionMessage: "The wait is over!", completionAction: "show-message" },
  dataTypes: [],
  requiredPlan: "FREE", supportedPlacements: ["page-section", "sidebar-widget", "header-addon", "floating-widget"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["countdown", "timer", "urgency"],
}

const leaderboard: ModuleDefinition = {
  moduleId: "leaderboard", name: "Leaderboard", icon: "Trophy", category: "GAMIFICATION",
  description: "Gamify your community with points and rankings. Track participation, quiz scores, event attendance, and more.",
  shortDescription: "Gamify your community with rankings",
  componentName: "LeaderboardModule", adminComponentName: "LeaderboardAdmin", hasAdminPanel: true,
  configSchema: {
    maxEntries: { type: "number", min: 10, max: 100, default: 25 },
    showAvatar: { type: "boolean", default: true }, showScore: { type: "boolean", default: true },
    showRank: { type: "boolean", default: true }, highlightTop3: { type: "boolean", default: true },
    timeRange: { type: "select", options: ["all-time", "this-month", "this-week", "event-specific"], default: "all-time" },
    scoreSource: { type: "select", options: ["manual", "quiz-scores", "event-attendance", "combined"], default: "manual" },
    pointsPerEvent: { type: "number", min: 1, max: 100, default: 10 },
    showBadges: { type: "boolean", default: false },
    animateChanges: { type: "boolean", default: true },
  },
  defaultConfig: { maxEntries: 25, showAvatar: true, showScore: true, showRank: true, highlightTop3: true, timeRange: "all-time", scoreSource: "manual", pointsPerEvent: 10, showBadges: false, animateChanges: true },
  dataTypes: ["leaderboard_entry", "leaderboard_badge"],
  requiredPlan: "STARTER", supportedPlacements: ["page-section", "sidebar-widget", "standalone-page"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["gamification", "ranking", "competition"],
}

// ── CONTENT Modules ──

const photoGallery: ModuleDefinition = {
  moduleId: "photo-gallery", name: "Photo Gallery", icon: "Images", category: "CONTENT",
  description: "Advanced photo gallery with albums, user uploads, and lightbox. Create multiple albums, enable community photo uploads, and manage photos with moderation.",
  shortDescription: "Photo albums with lightbox and uploads",
  componentName: "PhotoGalleryModule", adminComponentName: "PhotoGalleryAdmin", hasAdminPanel: true,
  configSchema: {
    maxAlbums: { type: "number", min: 1, max: 50, default: 20 },
    maxPhotosPerAlbum: { type: "number", min: 10, max: 200, default: 50 },
    allowUploads: { type: "boolean", default: false },
    moderateUploads: { type: "boolean", default: true },
    layout: { type: "select", options: ["masonry", "grid", "justified"], default: "masonry" },
    showCaptions: { type: "boolean", default: true },
    enableLightbox: { type: "boolean", default: true },
  },
  defaultConfig: { maxAlbums: 20, maxPhotosPerAlbum: 50, allowUploads: false, moderateUploads: true, layout: "masonry", showCaptions: true, enableLightbox: true },
  dataTypes: ["gallery_album", "gallery_photo", "gallery_upload_pending"],
  requiredPlan: "FREE", supportedPlacements: ["page-section", "standalone-page"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["photos", "gallery", "albums", "uploads"],
}

const blogPosts: ModuleDefinition = {
  moduleId: "blog-posts", name: "Blog Posts", icon: "FileText", category: "CONTENT",
  description: "Publish articles, updates, and announcements on your website. Full blog system with categories, rich text editing, cover images, and reading time estimates.",
  shortDescription: "Publish articles and announcements",
  componentName: "BlogPostsModule", adminComponentName: "BlogPostsAdmin", hasAdminPanel: true,
  configSchema: {
    postsPerPage: { type: "number", min: 6, max: 24, default: 9 },
    layout: { type: "select", options: ["grid", "list", "featured-grid"], default: "grid" },
    showAuthor: { type: "boolean", default: true },
    showDate: { type: "boolean", default: true },
    showCategories: { type: "boolean", default: true },
    showReadingTime: { type: "boolean", default: true },
    enableComments: { type: "boolean", default: false },
    showRelatedPosts: { type: "boolean", default: true },
  },
  defaultConfig: { postsPerPage: 9, layout: "grid", showAuthor: true, showDate: true, showCategories: true, showReadingTime: true, enableComments: false, showRelatedPosts: true },
  dataTypes: ["blog_post", "blog_category"],
  requiredPlan: "STARTER", supportedPlacements: ["page-section", "standalone-page"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["blog", "articles", "news", "content"],
}

// ── SOCIAL Modules ──

const sponsorShowcase: ModuleDefinition = {
  moduleId: "sponsor-showcase", name: "Sponsor Showcase", icon: "Award", category: "SOCIAL",
  description: "Enhanced sponsor display with tiered logos, sponsor profiles, animated carousels, and a 'Become a Sponsor' CTA. More powerful than the basic sponsors section.",
  shortDescription: "Showcase sponsors with profiles and tiers",
  componentName: "SponsorShowcaseModule", adminComponentName: "SponsorShowcaseAdmin", hasAdminPanel: true,
  configSchema: {
    displayMode: { type: "select", options: ["grid", "carousel", "ticker"], default: "grid" },
    showProfiles: { type: "boolean", default: false },
    showTierLabels: { type: "boolean", default: true },
    logoStyle: { type: "select", options: ["grayscale-hover", "full-color", "white"], default: "grayscale-hover" },
    showBecomeSponsor: { type: "boolean", default: true },
    becomeSponsorLink: { type: "text", default: "" },
  },
  defaultConfig: { displayMode: "grid", showProfiles: false, showTierLabels: true, logoStyle: "grayscale-hover", showBecomeSponsor: true, becomeSponsorLink: "" },
  dataTypes: ["sponsor_entry"],
  requiredPlan: "FREE", supportedPlacements: ["page-section", "footer-addon"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["sponsors", "partners", "logos"],
}

const teamProfiles: ModuleDefinition = {
  moduleId: "team-profiles", name: "Team Profiles", icon: "Users", category: "SOCIAL",
  description: "Enhanced team member showcase with detailed profiles, social links, clickable profile modals, filtering by role, and a 'Join Our Team' CTA.",
  shortDescription: "Showcase team with detailed profiles",
  componentName: "TeamProfilesModule", adminComponentName: "TeamProfilesAdmin", hasAdminPanel: true,
  configSchema: {
    layout: { type: "select", options: ["grid", "list", "carousel"], default: "grid" },
    cardStyle: { type: "select", options: ["minimal", "bordered", "elevated", "glass"], default: "elevated" },
    showDetailModal: { type: "boolean", default: true },
    showSocial: { type: "boolean", default: true },
    showJoinCTA: { type: "boolean", default: false },
    joinLink: { type: "text", default: "" },
    groupByRole: { type: "boolean", default: false },
    columns: { type: "select", options: ["2", "3", "4"], default: "3" },
  },
  defaultConfig: { layout: "grid", cardStyle: "elevated", showDetailModal: true, showSocial: true, showJoinCTA: false, joinLink: "", groupByRole: false, columns: "3" },
  dataTypes: ["team_member_profile"],
  requiredPlan: "FREE", supportedPlacements: ["page-section", "standalone-page"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["team", "members", "people", "profiles"],
}

// ── UTILITY Modules ──

const eventCalendarWidget: ModuleDefinition = {
  moduleId: "event-calendar-widget", name: "Event Calendar", icon: "CalendarDays", category: "UTILITY",
  description: "Interactive monthly calendar widget showing all your events. Navigate months, click days to see event details, and link to event pages.",
  shortDescription: "Interactive calendar of your events",
  componentName: "EventCalendarModule", hasAdminPanel: false,
  configSchema: {
    startDay: { type: "select", options: ["monday", "sunday"], default: "monday" },
    showWeekends: { type: "boolean", default: true },
    highlightToday: { type: "boolean", default: true },
    eventDotStyle: { type: "select", options: ["dot", "bar", "badge"], default: "dot" },
    maxEventsPerDay: { type: "number", min: 1, max: 5, default: 3 },
    colorByCategory: { type: "boolean", default: true },
    showPastEvents: { type: "boolean", default: false },
  },
  defaultConfig: { startDay: "monday", showWeekends: true, highlightToday: true, eventDotStyle: "dot", maxEventsPerDay: 3, colorByCategory: true, showPastEvents: false },
  dataTypes: [],
  requiredPlan: "FREE", supportedPlacements: ["page-section", "sidebar-widget"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["calendar", "events", "schedule"],
}

const volunteerSignup: ModuleDefinition = {
  moduleId: "volunteer-signup", name: "Volunteer Signup", icon: "HandHeart", category: "UTILITY",
  description: "Let visitors sign up as volunteers for events or the organization. Manage positions, track applications, and coordinate volunteers.",
  shortDescription: "Recruit and manage volunteers",
  componentName: "VolunteerSignupModule", adminComponentName: "VolunteerSignupAdmin", hasAdminPanel: true,
  configSchema: {
    requireLogin: { type: "boolean", default: false },
    showFilledPositions: { type: "boolean", default: false },
    allowMultipleApplications: { type: "boolean", default: true },
    autoConfirmation: { type: "boolean", default: false },
    notifyAdmin: { type: "boolean", default: true },
  },
  defaultConfig: { requireLogin: false, showFilledPositions: false, allowMultipleApplications: true, autoConfirmation: false, notifyAdmin: true },
  dataTypes: ["volunteer_position", "volunteer_application"],
  requiredPlan: "STARTER", supportedPlacements: ["page-section", "standalone-page"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["volunteer", "signup", "recruitment"],
}

// ── COMMERCE Modules ──

const merchandiseStore: ModuleDefinition = {
  moduleId: "merchandise-store", name: "Merchandise Store", icon: "ShoppingBag", category: "COMMERCE",
  description: "Showcase and sell event merchandise — t-shirts, caps, stickers, and more. Link to external stores or use contact-based ordering.",
  shortDescription: "Sell event merchandise and products",
  componentName: "MerchStoreModule", adminComponentName: "MerchStoreAdmin", hasAdminPanel: true,
  configSchema: {
    columns: { type: "select", options: ["2", "3", "4"], default: "3" },
    purchaseMethod: { type: "select", options: ["external-link", "razorpay", "contact"], default: "contact" },
    contactMethod: { type: "select", options: ["whatsapp", "email"], default: "whatsapp" },
    contactNumber: { type: "text", default: "" },
    contactEmail: { type: "text", default: "" },
    showPrices: { type: "boolean", default: true },
    currency: { type: "text", default: "INR" },
  },
  defaultConfig: { columns: "3", purchaseMethod: "contact", contactMethod: "whatsapp", contactNumber: "", contactEmail: "", showPrices: true, currency: "INR" },
  dataTypes: ["product"],
  requiredPlan: "PRO", supportedPlacements: ["page-section", "standalone-page"],
  incompatibleWith: [], isPremium: true, isBeta: false, tags: ["merchandise", "shop", "products", "ecommerce"],
}

const weatherWidget: ModuleDefinition = {
  moduleId: "weather-widget", name: "Weather Widget", icon: "CloudSun", category: "UTILITY",
  description: "Shows current weather for your city or event venue. Useful for outdoor events, run clubs, and sports organizations.",
  shortDescription: "Live weather for your event city",
  componentName: "WeatherWidgetModule", hasAdminPanel: false,
  configSchema: {
    city: { type: "text", default: "" },
    units: { type: "select", options: ["celsius", "fahrenheit"], default: "celsius" },
    showForecast: { type: "boolean", default: false },
    showHumidity: { type: "boolean", default: true },
    showWind: { type: "boolean", default: true },
    style: { type: "select", options: ["compact", "detailed"], default: "compact" },
  },
  defaultConfig: { city: "", units: "celsius", showForecast: false, showHumidity: true, showWind: true, style: "compact" },
  dataTypes: [],
  requiredPlan: "FREE", supportedPlacements: ["sidebar-widget", "header-addon"],
  incompatibleWith: [], isPremium: false, isBeta: false, tags: ["weather", "outdoor", "widget"],
}

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  "live-quiz": liveQuiz, "live-poll": livePoll, "countdown-timer": countdownTimer, "leaderboard": leaderboard,
  "photo-gallery": photoGallery, "blog-posts": blogPosts, "sponsor-showcase": sponsorShowcase, "team-profiles": teamProfiles,
  "event-calendar-widget": eventCalendarWidget, "volunteer-signup": volunteerSignup, "merchandise-store": merchandiseStore, "weather-widget": weatherWidget,
}

export function getModuleDefinition(moduleId: string) { return MODULE_REGISTRY[moduleId] }
export function getModulesByCategory(category: string) { return Object.values(MODULE_REGISTRY).filter(m => m.category === category) }
export function getAllModuleCategories() {
  return [
    { id: "ENGAGEMENT", name: "Engagement", icon: "Zap" },
    { id: "GAMIFICATION", name: "Gamification", icon: "Gamepad2" },
    { id: "CONTENT", name: "Content", icon: "FileText" },
    { id: "SOCIAL", name: "Social", icon: "Users" },
    { id: "UTILITY", name: "Utility", icon: "Settings" },
    { id: "COMMERCE", name: "Commerce", icon: "ShoppingBag" },
  ]
}
export function isModuleCompatible(moduleId: string, enabledModuleIds: string[]): boolean {
  const mod = MODULE_REGISTRY[moduleId]
  if (!mod) return false
  return !mod.incompatibleWith.some(id => enabledModuleIds.includes(id))
}
