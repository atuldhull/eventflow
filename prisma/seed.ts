import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { TEMPLATES } from "../src/lib/site-builder/templates"
import { MODULE_REGISTRY } from "../src/lib/site-builder/modules"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // 1. Super Admin
  const existingAdmin = await prisma.user.findUnique({ where: { email: "admin@eventflow.com" } })
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("Admin@123456", 12)
    await prisma.user.create({
      data: {
        email: "admin@eventflow.com",
        name: "Super Admin",
        passwordHash,
        role: "SUPER_ADMIN",
        emailVerified: new Date(),
      },
    })
    console.log("  ✅ Super admin created (admin@eventflow.com / Admin@123456)")
  } else {
    console.log("  ⏭️  Super admin already exists")
  }

  // 2. Sample data (development only)
  if (process.env.NODE_ENV !== "production") {
    const existingEnterprise = await prisma.enterprise.findUnique({ where: { slug: "demo-university" } })
    if (!existingEnterprise) {
      const admin = await prisma.user.findUnique({ where: { email: "admin@eventflow.com" } })
      if (admin) {
        const enterprise = await prisma.enterprise.create({
          data: {
            name: "Demo University",
            slug: "demo-university",
            email: "admin@demo-university.edu",
            type: "UNIVERSITY",
            ownerId: admin.id,
            isVerified: true,
          },
        })

        await prisma.organization.create({
          data: {
            name: "Tech Club",
            slug: "tech-club",
            email: "tech@demo-university.edu",
            category: "TECHNICAL",
            enterpriseId: enterprise.id,
          },
        })

        await prisma.organization.create({
          data: {
            name: "Cultural Society",
            slug: "cultural-society",
            email: "cultural@demo-university.edu",
            category: "CULTURAL",
            enterpriseId: enterprise.id,
          },
        })

        console.log("  ✅ Demo enterprise and organizations created")
      }
    } else {
      console.log("  ⏭️  Demo data already exists")
    }
  }

  // 3. Seed website builder data
  await seedTemplates()
  await seedFeatureModules()

  console.log("\n🎉 All seeding complete!")
}

// ============================================================================
// SEED TEMPLATES
// ============================================================================

const TEMPLATE_LONG_DESCRIPTIONS: Record<string, string> = {
  "sports-club-pro": "The ultimate template for sports and fitness organizations. This bold, dark-themed design features animated gradients, achievement showcases, and dynamic event displays. Perfect for run clubs, CrossFit boxes, cycling groups, swimming clubs, and any sports community that wants to stand out. Includes optimized layouts for race calendars, leaderboards, training schedules, and photo galleries.",
  "tech-community-dark": "A developer-first template inspired by modern code editors and GitHub's dark mode. Features monospace typography, glass-morphism effects, and a clean information hierarchy perfect for showcasing workshops, hackathons, and tech talks. Ideal for coding clubs, open-source communities, DevRel teams, and tech meetup groups.",
  "corporate-elegance": "A polished, professional template that conveys trust and competence. Light theme with crisp typography, structured layouts, and a formal color palette. Designed for corporate event management companies, conference organizers, leadership summits, and enterprise team-building programs. Supports detailed event listings, client testimonials, and partnership showcases.",
  "minimal-zen": "An ultra-clean, distraction-free design where content takes center stage. Generous whitespace, elegant serif headings, and a restrained color palette create a calm, sophisticated experience. Ideal for boutique event planners, art collectives, mindfulness workshops, and organizations that value simplicity over spectacle.",
  "festival-vibes": "A high-energy template bursting with color and personality. Vibrant gradients, playful animations, and bold typography make this the perfect choice for college festivals, music events, cultural celebrations, and creative gatherings. Supports video backgrounds, countdown timers, photo galleries, and merchandise stores.",
  "education-hub": "A warm, inviting template balanced between academic authority and approachability. Teal accents, rounded UI elements, and friendly typography create a welcoming learning environment. Designed for university departments, training institutes, workshop providers, and academic conferences. Supports course-style listings, faculty profiles, and student testimonials.",
}

async function seedTemplates() {
  console.log("\n🎨 Seeding website templates...")

  for (const [slug, tpl] of Object.entries(TEMPLATES)) {
    await prisma.siteTemplate.upsert({
      where: { slug },
      update: {
        name: tpl.name,
        description: tpl.description,
        longDescription: TEMPLATE_LONG_DESCRIPTIONS[slug] || tpl.description,
        category: tpl.category,
        thumbnail: `/templates/${slug}/thumbnail.jpg`,
        previewImages: [
          `/templates/${slug}/preview-1.jpg`,
          `/templates/${slug}/preview-2.jpg`,
          `/templates/${slug}/preview-3.jpg`,
        ],
        tags: tpl.tags,
        isPremium: tpl.isPremium,
        isActive: true,
        isFeatured: tpl.isFeatured,
        requiredPlan: tpl.requiredPlan,
        version: "1.0.0",
        author: "EventFlow",
        defaultSections: tpl.defaultSections as any,
        defaultStyles: tpl.defaultStyles as any,
        supportedFeatures: tpl.supportedFeatures,
        sectionLayout: "single-column",
      },
      create: {
        name: tpl.name,
        slug,
        description: tpl.description,
        longDescription: TEMPLATE_LONG_DESCRIPTIONS[slug] || tpl.description,
        category: tpl.category,
        thumbnail: `/templates/${slug}/thumbnail.jpg`,
        previewImages: [
          `/templates/${slug}/preview-1.jpg`,
          `/templates/${slug}/preview-2.jpg`,
          `/templates/${slug}/preview-3.jpg`,
        ],
        tags: tpl.tags,
        isPremium: tpl.isPremium,
        isActive: true,
        isFeatured: tpl.isFeatured,
        requiredPlan: tpl.requiredPlan,
        version: "1.0.0",
        author: "EventFlow",
        defaultSections: tpl.defaultSections as any,
        defaultStyles: tpl.defaultStyles as any,
        supportedFeatures: tpl.supportedFeatures,
        sectionLayout: "single-column",
      },
    })
    console.log(`  ✓ Template: ${tpl.name}`)
  }

  console.log(`✅ Seeded ${Object.keys(TEMPLATES).length} templates`)
}

// ============================================================================
// SEED FEATURE MODULES
// ============================================================================

interface ModuleSeedData {
  moduleId: string
  shortDescription: string
  componentPath: string
  adminComponentPath?: string
  configSchema: Record<string, any>
  defaultConfig: Record<string, any>
  dataSchema?: Record<string, any>
  requiredPermissions: string[]
  sortOrder: number
  isNew: boolean
  setupGuide: string
}

const MODULE_SEED_EXTRAS: Record<string, ModuleSeedData> = {
  "live-quiz": {
    moduleId: "live-quiz",
    shortDescription: "Engage your audience with interactive quizzes",
    componentPath: "site-modules/live-quiz/LiveQuizModule",
    adminComponentPath: "site-modules/live-quiz/LiveQuizAdmin",
    configSchema: {
      type: "object",
      properties: {
        maxQuestions: { type: "number", minimum: 1, maximum: 50, default: 10, title: "Max Questions" },
        timePerQuestion: { type: "number", minimum: 5, maximum: 120, default: 30, title: "Time per Question (seconds)" },
        showLeaderboard: { type: "boolean", default: true, title: "Show Leaderboard" },
        allowRetakes: { type: "boolean", default: false, title: "Allow Retakes" },
        shuffleQuestions: { type: "boolean", default: true, title: "Shuffle Questions" },
        shuffleOptions: { type: "boolean", default: true, title: "Shuffle Options" },
        showCorrectAnswer: { type: "boolean", default: true, title: "Show Correct Answer" },
        pointsPerCorrect: { type: "number", minimum: 1, maximum: 100, default: 10, title: "Points per Correct Answer" },
        bonusForSpeed: { type: "boolean", default: true, title: "Speed Bonus" },
        requireLogin: { type: "boolean", default: true, title: "Require Login" },
      },
    },
    defaultConfig: { maxQuestions: 10, timePerQuestion: 30, showLeaderboard: true, allowRetakes: false, shuffleQuestions: true, shuffleOptions: true, showCorrectAnswer: true, pointsPerCorrect: 10, bonusForSpeed: true, requireLogin: true },
    dataSchema: { quiz_definition: { type: "object" }, quiz_response: { type: "object" }, quiz_result: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 1,
    isNew: true,
    setupGuide: "## Getting Started with Live Quiz\n\n1. Go to your website admin panel\n2. Click **Feature Modules** → **Live Quiz**\n3. Create your first quiz by clicking **Create Quiz**\n4. Add questions with multiple choice answers\n5. Activate the quiz and share the link with your audience\n\nParticipants will see the quiz on your website and can compete for the top spot on the leaderboard!",
  },
  "live-poll": {
    moduleId: "live-poll",
    shortDescription: "Real-time polls with live results",
    componentPath: "site-modules/live-poll/LivePollModule",
    adminComponentPath: "site-modules/live-poll/LivePollAdmin",
    configSchema: {
      type: "object",
      properties: {
        allowMultipleVotes: { type: "boolean", default: false, title: "Allow Multiple Votes" },
        showResults: { type: "string", enum: ["always", "after-vote", "after-close"], default: "after-vote", title: "Show Results" },
        resultDisplay: { type: "string", enum: ["bar-chart", "pie-chart", "percentage"], default: "bar-chart", title: "Result Display" },
        anonymous: { type: "boolean", default: false, title: "Anonymous Voting" },
        requireLogin: { type: "boolean", default: true, title: "Require Login" },
        autoClose: { type: "boolean", default: false, title: "Auto-Close" },
      },
    },
    defaultConfig: { allowMultipleVotes: false, showResults: "after-vote", resultDisplay: "bar-chart", anonymous: false, requireLogin: true, autoClose: false },
    dataSchema: { poll_definition: { type: "object" }, poll_vote: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 2,
    isNew: true,
    setupGuide: "## Getting Started with Live Poll\n\n1. Go to your website admin panel\n2. Click **Feature Modules** → **Live Poll**\n3. Enter a question and at least 2 options\n4. Click **Create Poll**\n5. The poll appears live on your website\n\nResults update in real-time as people vote!",
  },
  "countdown-timer": {
    moduleId: "countdown-timer",
    shortDescription: "Build anticipation with countdown timers",
    componentPath: "site-modules/countdown-timer/CountdownTimerModule",
    configSchema: {
      type: "object",
      properties: {
        style: { type: "string", enum: ["flip", "minimal", "bold", "circular"], default: "flip", title: "Visual Style" },
        showDays: { type: "boolean", default: true, title: "Show Days" },
        showHours: { type: "boolean", default: true, title: "Show Hours" },
        showMinutes: { type: "boolean", default: true, title: "Show Minutes" },
        showSeconds: { type: "boolean", default: true, title: "Show Seconds" },
        showLabels: { type: "boolean", default: true, title: "Show Labels" },
        size: { type: "string", enum: ["small", "medium", "large"], default: "medium", title: "Size" },
        targetType: { type: "string", enum: ["next-event", "custom-date"], default: "next-event", title: "Target" },
        completionMessage: { type: "string", default: "The wait is over!", title: "Completion Message" },
        completionAction: { type: "string", enum: ["show-message", "redirect", "hide"], default: "show-message", title: "On Completion" },
      },
    },
    defaultConfig: { style: "flip", showDays: true, showHours: true, showMinutes: true, showSeconds: true, showLabels: true, size: "medium", targetType: "next-event", completionMessage: "The wait is over!", completionAction: "show-message" },
    requiredPermissions: [],
    sortOrder: 3,
    isNew: false,
    setupGuide: "## Getting Started with Countdown Timer\n\n1. Enable the module in your website settings\n2. Choose a visual style: **Flip**, **Minimal**, **Bold**, or **Circular**\n3. Set target to **Next Event** (auto-detects) or pick a **Custom Date**\n4. Customize which units to display\n\nThe timer updates in real-time and shows a message when the countdown reaches zero.",
  },
  "leaderboard": {
    moduleId: "leaderboard",
    shortDescription: "Gamify your community with rankings",
    componentPath: "site-modules/leaderboard/LeaderboardModule",
    adminComponentPath: "site-modules/leaderboard/LeaderboardAdmin",
    configSchema: {
      type: "object",
      properties: {
        maxEntries: { type: "number", minimum: 10, maximum: 100, default: 25, title: "Max Entries" },
        showAvatar: { type: "boolean", default: true, title: "Show Avatars" },
        showScore: { type: "boolean", default: true, title: "Show Scores" },
        showRank: { type: "boolean", default: true, title: "Show Rank Numbers" },
        highlightTop3: { type: "boolean", default: true, title: "Highlight Top 3" },
        timeRange: { type: "string", enum: ["all-time", "this-month", "this-week", "event-specific"], default: "all-time", title: "Time Range" },
        scoreSource: { type: "string", enum: ["manual", "quiz-scores", "event-attendance", "combined"], default: "manual", title: "Score Source" },
        pointsPerEvent: { type: "number", minimum: 1, maximum: 100, default: 10, title: "Points per Event" },
        showBadges: { type: "boolean", default: false, title: "Show Badges" },
        animateChanges: { type: "boolean", default: true, title: "Animate Changes" },
      },
    },
    defaultConfig: { maxEntries: 25, showAvatar: true, showScore: true, showRank: true, highlightTop3: true, timeRange: "all-time", scoreSource: "manual", pointsPerEvent: 10, showBadges: false, animateChanges: true },
    dataSchema: { leaderboard_entry: { type: "object" }, leaderboard_badge: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 4,
    isNew: true,
    setupGuide: "## Getting Started with Leaderboard\n\n1. Enable the module and choose a **Score Source**\n2. For **Manual**: add entries via the admin panel\n3. For **Quiz Scores**: scores auto-aggregate from Live Quiz results\n4. For **Event Attendance**: members earn points per event attended\n5. Customize display: top 3 podium, avatars, time filters\n\nMembers can see their rank and compete to climb the leaderboard!",
  },
  "photo-gallery": {
    moduleId: "photo-gallery",
    shortDescription: "Photo albums with lightbox and uploads",
    componentPath: "site-modules/photo-gallery/PhotoGalleryModule",
    adminComponentPath: "site-modules/photo-gallery/PhotoGalleryAdmin",
    configSchema: {
      type: "object",
      properties: {
        maxAlbums: { type: "number", minimum: 1, maximum: 50, default: 20, title: "Max Albums" },
        maxPhotosPerAlbum: { type: "number", minimum: 10, maximum: 200, default: 50, title: "Max Photos per Album" },
        allowUploads: { type: "boolean", default: false, title: "Allow User Uploads" },
        moderateUploads: { type: "boolean", default: true, title: "Moderate Uploads" },
        layout: { type: "string", enum: ["masonry", "grid", "justified"], default: "masonry", title: "Layout" },
        showCaptions: { type: "boolean", default: true, title: "Show Captions" },
        enableLightbox: { type: "boolean", default: true, title: "Enable Lightbox" },
      },
    },
    defaultConfig: { maxAlbums: 20, maxPhotosPerAlbum: 50, allowUploads: false, moderateUploads: true, layout: "masonry", showCaptions: true, enableLightbox: true },
    dataSchema: { gallery_album: { type: "object" }, gallery_photo: { type: "object" }, gallery_upload_pending: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 5,
    isNew: false,
    setupGuide: "## Getting Started with Photo Gallery\n\n1. Open the admin panel and click **Create Album**\n2. Name your album and add a description\n3. Upload photos via drag & drop\n4. Optionally enable **User Uploads** to let members contribute\n5. Photos appear in a beautiful masonry grid with lightbox\n\nOrganize your event memories into albums that visitors can browse!",
  },
  "blog-posts": {
    moduleId: "blog-posts",
    shortDescription: "Publish articles and announcements",
    componentPath: "site-modules/blog-posts/BlogPostsModule",
    adminComponentPath: "site-modules/blog-posts/BlogPostsAdmin",
    configSchema: {
      type: "object",
      properties: {
        postsPerPage: { type: "number", minimum: 6, maximum: 24, default: 9, title: "Posts per Page" },
        layout: { type: "string", enum: ["grid", "list", "featured-grid"], default: "grid", title: "Layout" },
        showAuthor: { type: "boolean", default: true, title: "Show Author" },
        showDate: { type: "boolean", default: true, title: "Show Date" },
        showCategories: { type: "boolean", default: true, title: "Show Categories" },
        showReadingTime: { type: "boolean", default: true, title: "Show Reading Time" },
        enableComments: { type: "boolean", default: false, title: "Enable Comments" },
        showRelatedPosts: { type: "boolean", default: true, title: "Show Related Posts" },
      },
    },
    defaultConfig: { postsPerPage: 9, layout: "grid", showAuthor: true, showDate: true, showCategories: true, showReadingTime: true, enableComments: false, showRelatedPosts: true },
    dataSchema: { blog_post: { type: "object" }, blog_category: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 6,
    isNew: false,
    setupGuide: "## Getting Started with Blog Posts\n\n1. Open the admin panel and click **New Post**\n2. Write your article with the rich text editor\n3. Add a cover image, category, and tags\n4. Click **Publish** to make it live, or **Save Draft** to finish later\n5. Posts appear on your website in a beautiful card grid\n\nShare updates, event recaps, and community stories with your audience!",
  },
  "sponsor-showcase": {
    moduleId: "sponsor-showcase",
    shortDescription: "Showcase sponsors with profiles and tiers",
    componentPath: "site-modules/sponsor-showcase/SponsorShowcaseModule",
    adminComponentPath: "site-modules/sponsor-showcase/SponsorShowcaseAdmin",
    configSchema: {
      type: "object",
      properties: {
        displayMode: { type: "string", enum: ["grid", "carousel", "ticker"], default: "grid", title: "Display Mode" },
        showProfiles: { type: "boolean", default: false, title: "Show Sponsor Profiles" },
        showTierLabels: { type: "boolean", default: true, title: "Show Tier Labels" },
        logoStyle: { type: "string", enum: ["grayscale-hover", "full-color", "white"], default: "grayscale-hover", title: "Logo Style" },
        showBecomeSponsor: { type: "boolean", default: true, title: "Show Become a Sponsor CTA" },
        becomeSponsorLink: { type: "string", default: "", title: "Become a Sponsor Link" },
      },
    },
    defaultConfig: { displayMode: "grid", showProfiles: false, showTierLabels: true, logoStyle: "grayscale-hover", showBecomeSponsor: true, becomeSponsorLink: "" },
    dataSchema: { sponsor_entry: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 7,
    isNew: false,
    setupGuide: "## Getting Started with Sponsor Showcase\n\n1. Open the admin panel and click **Add Sponsor**\n2. Enter the sponsor's name, logo, website, and tier\n3. Choose a display mode: **Grid**, **Carousel**, or **Ticker**\n4. Enable **Sponsor Profiles** for clickable detail modals\n5. Add a **Become a Sponsor** CTA link\n\nShowcase your sponsors and partners professionally!",
  },
  "team-profiles": {
    moduleId: "team-profiles",
    shortDescription: "Showcase team with detailed profiles",
    componentPath: "site-modules/team-profiles/TeamProfilesModule",
    adminComponentPath: "site-modules/team-profiles/TeamProfilesAdmin",
    configSchema: {
      type: "object",
      properties: {
        layout: { type: "string", enum: ["grid", "list", "carousel"], default: "grid", title: "Layout" },
        cardStyle: { type: "string", enum: ["minimal", "bordered", "elevated", "glass"], default: "elevated", title: "Card Style" },
        showDetailModal: { type: "boolean", default: true, title: "Show Detail Modal" },
        showSocial: { type: "boolean", default: true, title: "Show Social Links" },
        showJoinCTA: { type: "boolean", default: false, title: "Show Join CTA" },
        joinLink: { type: "string", default: "", title: "Join Link" },
        groupByRole: { type: "boolean", default: false, title: "Group by Role" },
        columns: { type: "string", enum: ["2", "3", "4"], default: "3", title: "Columns" },
      },
    },
    defaultConfig: { layout: "grid", cardStyle: "elevated", showDetailModal: true, showSocial: true, showJoinCTA: false, joinLink: "", groupByRole: false, columns: "3" },
    dataSchema: { team_member_profile: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 8,
    isNew: false,
    setupGuide: "## Getting Started with Team Profiles\n\n1. Open the admin panel and click **Add Member**\n2. Enter name, role, bio, avatar, and social links\n3. Or click **Import from Org** to auto-fill from organization members\n4. Choose layout style and number of columns\n5. Enable **Detail Modal** for clickable profile popups\n\nShowcase your team members with rich profiles and social links!",
  },
  "event-calendar-widget": {
    moduleId: "event-calendar-widget",
    shortDescription: "Interactive calendar of your events",
    componentPath: "site-modules/event-calendar/EventCalendarModule",
    configSchema: {
      type: "object",
      properties: {
        startDay: { type: "string", enum: ["monday", "sunday"], default: "monday", title: "Week Start Day" },
        showWeekends: { type: "boolean", default: true, title: "Show Weekends" },
        highlightToday: { type: "boolean", default: true, title: "Highlight Today" },
        eventDotStyle: { type: "string", enum: ["dot", "bar", "badge"], default: "dot", title: "Event Indicator Style" },
        maxEventsPerDay: { type: "number", minimum: 1, maximum: 5, default: 3, title: "Max Events per Day" },
        colorByCategory: { type: "boolean", default: true, title: "Color by Category" },
        showPastEvents: { type: "boolean", default: false, title: "Show Past Events" },
      },
    },
    defaultConfig: { startDay: "monday", showWeekends: true, highlightToday: true, eventDotStyle: "dot", maxEventsPerDay: 3, colorByCategory: true, showPastEvents: false },
    requiredPermissions: [],
    sortOrder: 9,
    isNew: false,
    setupGuide: "## Getting Started with Event Calendar\n\n1. Enable the module on your website\n2. The calendar auto-populates from your organization's events\n3. Visitors can navigate months and click days to see event details\n4. Customize the week start day, indicator style, and colors\n\nNo manual setup needed — events appear automatically!",
  },
  "volunteer-signup": {
    moduleId: "volunteer-signup",
    shortDescription: "Recruit and manage volunteers",
    componentPath: "site-modules/volunteer-signup/VolunteerSignupModule",
    adminComponentPath: "site-modules/volunteer-signup/VolunteerSignupAdmin",
    configSchema: {
      type: "object",
      properties: {
        requireLogin: { type: "boolean", default: false, title: "Require Login" },
        showFilledPositions: { type: "boolean", default: false, title: "Show Filled Positions" },
        allowMultipleApplications: { type: "boolean", default: true, title: "Allow Multiple Applications" },
        autoConfirmation: { type: "boolean", default: false, title: "Auto-Accept Applications" },
        notifyAdmin: { type: "boolean", default: true, title: "Notify Admin on Application" },
      },
    },
    defaultConfig: { requireLogin: false, showFilledPositions: false, allowMultipleApplications: true, autoConfirmation: false, notifyAdmin: true },
    dataSchema: { volunteer_position: { type: "object" }, volunteer_application: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 10,
    isNew: false,
    setupGuide: "## Getting Started with Volunteer Signup\n\n1. Open the admin panel and click **Create Position**\n2. Describe the role, time commitment, and skills needed\n3. Set the number of spots available\n4. Visitors can browse positions and submit applications\n5. Review and accept/reject applications in the admin panel\n\nRecruit volunteers for your events with a simple application flow!",
  },
  "merchandise-store": {
    moduleId: "merchandise-store",
    shortDescription: "Sell event merchandise and products",
    componentPath: "site-modules/merchandise-store/MerchStoreModule",
    adminComponentPath: "site-modules/merchandise-store/MerchStoreAdmin",
    configSchema: {
      type: "object",
      properties: {
        columns: { type: "string", enum: ["2", "3", "4"], default: "3", title: "Columns" },
        purchaseMethod: { type: "string", enum: ["external-link", "razorpay", "contact"], default: "contact", title: "Purchase Method" },
        contactMethod: { type: "string", enum: ["whatsapp", "email"], default: "whatsapp", title: "Contact Method" },
        contactNumber: { type: "string", default: "", title: "WhatsApp Number" },
        contactEmail: { type: "string", default: "", title: "Contact Email" },
        showPrices: { type: "boolean", default: true, title: "Show Prices" },
        currency: { type: "string", default: "INR", title: "Currency" },
      },
    },
    defaultConfig: { columns: "3", purchaseMethod: "contact", contactMethod: "whatsapp", contactNumber: "", contactEmail: "", showPrices: true, currency: "INR" },
    dataSchema: { product: { type: "object" } },
    requiredPermissions: ["org:edit"],
    sortOrder: 11,
    isNew: false,
    setupGuide: "## Getting Started with Merchandise Store\n\n1. Open the admin panel and click **Add Product**\n2. Enter product name, price, description, and images\n3. Add sizes/variants if applicable\n4. Choose a purchase method: **WhatsApp**, **Email**, or **External Link**\n5. Products display in a grid with buy buttons\n\nSell event merchandise without needing a full e-commerce setup!",
  },
  "weather-widget": {
    moduleId: "weather-widget",
    shortDescription: "Live weather for your event city",
    componentPath: "site-modules/weather-widget/WeatherWidgetModule",
    configSchema: {
      type: "object",
      properties: {
        city: { type: "string", default: "", title: "City" },
        units: { type: "string", enum: ["celsius", "fahrenheit"], default: "celsius", title: "Temperature Units" },
        showForecast: { type: "boolean", default: false, title: "Show 3-Day Forecast" },
        showHumidity: { type: "boolean", default: true, title: "Show Humidity" },
        showWind: { type: "boolean", default: true, title: "Show Wind Speed" },
        style: { type: "string", enum: ["compact", "detailed"], default: "compact", title: "Display Style" },
      },
    },
    defaultConfig: { city: "", units: "celsius", showForecast: false, showHumidity: true, showWind: true, style: "compact" },
    requiredPermissions: [],
    sortOrder: 12,
    isNew: false,
    setupGuide: "## Getting Started with Weather Widget\n\n1. Enable the module in your website settings\n2. Enter your city name in the configuration\n3. Choose **Compact** or **Detailed** display style\n4. Optionally enable the 3-day forecast\n\nRequires a `WEATHER_API_KEY` environment variable (free from OpenWeatherMap).",
  },
}

async function seedFeatureModules() {
  console.log("\n🧩 Seeding feature modules...")

  for (const [moduleId, reg] of Object.entries(MODULE_REGISTRY)) {
    const extra = MODULE_SEED_EXTRAS[moduleId]
    if (!extra) {
      console.log(`  ⚠ No seed data for module: ${moduleId}`)
      continue
    }

    await prisma.featureModule.upsert({
      where: { moduleId },
      update: {
        name: reg.name,
        description: reg.description,
        shortDescription: extra.shortDescription,
        icon: reg.icon,
        category: reg.category,
        componentPath: extra.componentPath,
        hasAdminPanel: reg.hasAdminPanel,
        adminComponentPath: extra.adminComponentPath || null,
        configSchema: extra.configSchema as any,
        defaultConfig: extra.defaultConfig as any,
        dataSchema: extra.dataSchema as any || null,
        requiredPlan: reg.requiredPlan,
        requiredPermissions: extra.requiredPermissions,
        supportedTemplates: [],
        incompatibleWith: reg.incompatibleWith,
        supportedPlacements: reg.supportedPlacements,
        isPremium: reg.isPremium,
        isActive: true,
        isBeta: reg.isBeta,
        isNew: extra.isNew,
        sortOrder: extra.sortOrder,
        setupGuide: extra.setupGuide,
      },
      create: {
        moduleId,
        name: reg.name,
        description: reg.description,
        shortDescription: extra.shortDescription,
        icon: reg.icon,
        category: reg.category,
        componentPath: extra.componentPath,
        hasAdminPanel: reg.hasAdminPanel,
        adminComponentPath: extra.adminComponentPath || null,
        configSchema: extra.configSchema as any,
        defaultConfig: extra.defaultConfig as any,
        dataSchema: extra.dataSchema as any || null,
        requiredPlan: reg.requiredPlan,
        requiredPermissions: extra.requiredPermissions,
        supportedTemplates: [],
        incompatibleWith: reg.incompatibleWith,
        supportedPlacements: reg.supportedPlacements,
        isPremium: reg.isPremium,
        isActive: true,
        isBeta: reg.isBeta,
        isNew: extra.isNew,
        sortOrder: extra.sortOrder,
        setupGuide: extra.setupGuide,
      },
    })
    console.log(`  ✓ Module: ${reg.name}`)
  }

  console.log(`✅ Seeded ${Object.keys(MODULE_REGISTRY).length} feature modules`)
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
