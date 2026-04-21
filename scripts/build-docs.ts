/**
 * Generates two PDFs into ./docs/
 *   - user-guide.pdf        Onboarding guide for new attendees and organizers.
 *   - admin-reference.pdf   Role-by-role function/URL map for the admin side.
 *
 * Pure Node, no Chromium. Uses pdfkit for deterministic, cross-platform
 * output. The layout helpers at the top of the file are shared between the
 * two documents so typography and spacing stay consistent.
 *
 * Run with:  npx tsx scripts/build-docs.ts
 */
import PDFDocument from "pdfkit"
import fs from "fs"
import path from "path"

// ─── Layout helpers (shared by both docs) ─────────────────────────────────
const MARGIN = 56
const PAGE_WIDTH = 595.28  // A4 portrait
const PAGE_HEIGHT = 841.89
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const COLORS = {
  ink: "#0B0B10",
  inkSoft: "#2B2B35",
  muted: "#5B5B66",
  subtle: "#9A9AA5",
  rule: "#E6E6ED",
  accent: "#4F46E5",
  accentSoft: "#EEF2FF",
  successBg: "#ECFDF5",
  success: "#047857",
  warnBg: "#FFFBEB",
  warn: "#92400E",
}

type Doc = PDFKit.PDFDocument

function newDoc(meta: { title: string; subject: string }): Doc {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    // Disabling compression sidesteps a Node zlib stack-overflow that pdfkit
    // 0.18 hits on certain large pages. File is ~2x bigger but still small.
    compress: false,
    info: {
      Title: meta.title,
      Author: "EventFlow",
      Subject: meta.subject,
      CreationDate: new Date(),
    },
    autoFirstPage: false,
  })
  return doc
}

/** Reserve vertical space; if the current page doesn't have enough, start a new one. */
function ensureRoom(doc: Doc, needed: number) {
  if (doc.y + needed > PAGE_HEIGHT - MARGIN) doc.addPage()
}

function h1(doc: Doc, text: string) {
  ensureRoom(doc, 60)
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(22).text(text)
  doc.moveDown(0.3)
  const y = doc.y
  doc.moveTo(MARGIN, y).lineTo(MARGIN + 28, y).lineWidth(2).strokeColor(COLORS.accent).stroke()
  doc.moveDown(0.9)
}

function h2(doc: Doc, text: string) {
  ensureRoom(doc, 40)
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(14).text(text)
  doc.moveDown(0.4)
}

function h3(doc: Doc, text: string) {
  ensureRoom(doc, 26)
  doc.fillColor(COLORS.inkSoft).font("Helvetica-Bold").fontSize(11).text(text)
  doc.moveDown(0.25)
}

function para(doc: Doc, text: string, opts: { muted?: boolean } = {}) {
  doc.fillColor(opts.muted ? COLORS.muted : COLORS.inkSoft)
    .font("Helvetica").fontSize(10.5)
    .text(text, { align: "left", lineGap: 2 })
  doc.moveDown(0.6)
}

function bullets(doc: Doc, items: string[]) {
  doc.fillColor(COLORS.inkSoft).font("Helvetica").fontSize(10.5)
  for (const item of items) {
    ensureRoom(doc, 20)
    const x = MARGIN + 10
    doc.circle(MARGIN + 4, doc.y + 5, 1.5).fill(COLORS.accent)
    doc.fillColor(COLORS.inkSoft).text(item, x, doc.y, {
      width: CONTENT_WIDTH - 10,
      lineGap: 2,
    })
    doc.moveDown(0.25)
  }
  doc.moveDown(0.4)
}

function steps(doc: Doc, items: string[]) {
  doc.font("Helvetica").fontSize(10.5)
  items.forEach((item, i) => {
    ensureRoom(doc, 26)
    const numX = MARGIN
    const textX = MARGIN + 22
    const numY = doc.y
    // Numbered pill
    doc.roundedRect(numX, numY, 16, 16, 4).fillColor(COLORS.accentSoft).fill()
    doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9)
      .text(String(i + 1), numX, numY + 4, { width: 16, align: "center" })
    // Step text
    doc.fillColor(COLORS.inkSoft).font("Helvetica").fontSize(10.5)
      .text(item, textX, numY + 1, { width: CONTENT_WIDTH - 22, lineGap: 2 })
    doc.moveDown(0.4)
  })
  doc.moveDown(0.3)
}

/** Monospace code snippet with soft background. */
function code(doc: Doc, text: string) {
  ensureRoom(doc, 28)
  const y = doc.y
  const h = 20
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, h, 4).fillColor(COLORS.accentSoft).fill()
  doc.fillColor(COLORS.accent).font("Courier").fontSize(9.5)
    .text(text, MARGIN + 8, y + 5, { width: CONTENT_WIDTH - 16 })
  doc.y = y + h + 6
}

/** Colored callout box — for tips, warnings, etc. */
function callout(doc: Doc, kind: "tip" | "warn", title: string, body: string) {
  ensureRoom(doc, 70)
  const bg = kind === "tip" ? COLORS.successBg : COLORS.warnBg
  const fg = kind === "tip" ? COLORS.success : COLORS.warn
  const startY = doc.y
  const pad = 10
  doc.roundedRect(MARGIN, startY, CONTENT_WIDTH, 0, 6).fillColor(bg).fill()
  doc.fillColor(fg).font("Helvetica-Bold").fontSize(10)
    .text(title, MARGIN + pad, startY + pad, { width: CONTENT_WIDTH - pad * 2 })
  doc.fillColor(COLORS.inkSoft).font("Helvetica").fontSize(10)
    .text(body, MARGIN + pad, doc.y + 2, { width: CONTENT_WIDTH - pad * 2, lineGap: 2 })
  const endY = doc.y + pad
  // Re-draw the rounded rect now that we know the actual height.
  doc.save()
  doc.roundedRect(MARGIN, startY, CONTENT_WIDTH, endY - startY, 6).fillColor(bg).fillOpacity(0.85).fill()
  doc.restore()
  doc.fillColor(fg).font("Helvetica-Bold").fontSize(10)
    .text(title, MARGIN + pad, startY + pad, { width: CONTENT_WIDTH - pad * 2 })
  doc.fillColor(COLORS.inkSoft).font("Helvetica").fontSize(10)
    .text(body, MARGIN + pad, startY + pad + 16, { width: CONTENT_WIDTH - pad * 2, lineGap: 2 })
  doc.y = endY
  doc.moveDown(0.8)
}

/** Two-column key/value table. Good for "role → access" matrices. */
function kvTable(doc: Doc, rows: { k: string; v: string }[], keyWidth = 150) {
  for (const { k, v } of rows) {
    ensureRoom(doc, 22)
    const startY = doc.y
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink)
      .text(k, MARGIN, startY, { width: keyWidth - 10 })
    const keyHeight = doc.y - startY
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.inkSoft)
      .text(v, MARGIN + keyWidth, startY, { width: CONTENT_WIDTH - keyWidth, lineGap: 1.5 })
    const valHeight = doc.y - startY
    doc.y = startY + Math.max(keyHeight, valHeight)
    doc.moveDown(0.2)
    // Separator
    const sepY = doc.y
    doc.moveTo(MARGIN, sepY).lineTo(MARGIN + CONTENT_WIDTH, sepY)
      .lineWidth(0.5).strokeColor(COLORS.rule).stroke()
    doc.moveDown(0.3)
  }
  doc.moveDown(0.3)
}

function coverPage(doc: Doc, opts: { eyebrow: string; title: string; subtitle: string; footer: string }) {
  doc.addPage()
  // Top accent bar
  doc.rect(0, 0, PAGE_WIDTH, 5).fillColor(COLORS.accent).fill()
  // Eyebrow
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9)
    .text(opts.eyebrow.toUpperCase(), MARGIN, 140, { characterSpacing: 1.5 })
  // Title
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(40)
    .text(opts.title, MARGIN, 160, { width: CONTENT_WIDTH, lineGap: 2 })
  // Subtitle
  doc.moveDown(0.5)
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(13)
    .text(opts.subtitle, { width: CONTENT_WIDTH, lineGap: 3 })
  // Bottom-left brand
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(14)
    .text("EventFlow", MARGIN, PAGE_HEIGHT - 100)
  doc.fillColor(COLORS.subtle).font("Helvetica").fontSize(9)
    .text(opts.footer, MARGIN, PAGE_HEIGHT - 80, { width: CONTENT_WIDTH })
  // Accent corner mark
  doc.rect(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 1, 28, 2).fillColor(COLORS.accent).fill()
}

// Footers were previously attached via `pageAdded`, but pdfkit's doc.text()
// inside that handler can trigger another page break (recursion → stack
// overflow). Keeping pages footerless for now; a headless post-pass over
// doc.bufferedPageRange() is the proper fix if we want page numbers back.

// ─── PDF 1: User Guide ─────────────────────────────────────────────────────
function buildUserGuide(outPath: string) {
  const doc = newDoc({
    title: "EventFlow — User Guide",
    subject: "Onboarding guide for attendees and organizers",
  })
  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  coverPage(doc, {
    eyebrow: "Platform Guide",
    title: "EventFlow",
    subtitle: "A walkthrough for attendees and organizers. How to sign up, find events, register, collect tickets, and run your own.",
    footer: `Revision 1.0  ·  Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
  })

  // ── Intro ──
  doc.addPage()
  h1(doc, "What is EventFlow?")
  para(doc,
    "EventFlow is a multi-tenant event management platform. Universities, companies, and community organizations use it to publish their events, collect registrations, take payments, check people in at the door, issue certificates, and run feature modules like live quizzes and leaderboards around each event.",
  )
  para(doc,
    "The same application serves three distinct audiences, and the interface adapts to who's logged in:",
  )
  kvTable(doc, [
    { k: "Attendees", v: "Browse events, register, save events for later, show tickets at the venue, collect certificates." },
    { k: "Organizers", v: "Create events with a 6-step wizard, manage registrations, set up coupons, run check-in, issue refunds, build a public website for the organization." },
    { k: "Super admins", v: "Platform operators overseeing all enterprises, organizations, payments, and audit logs." },
  ], 110)

  // ── Getting started ──
  h1(doc, "Getting started")
  h2(doc, "Sign up")
  steps(doc, [
    "Go to /signup. Enter your name, email, a password that meets the strength indicator, and your phone.",
    "Tick the Terms of Service and Privacy Policy checkbox. Both open in a new tab so you can read them without losing your form.",
    "Optionally fill in college or company details — these can be added later from your profile.",
    "A 6-digit OTP is sent to your email. Enter it on the verification screen.",
    "You land on your dashboard. You're ready to register for events.",
  ])
  callout(doc, "tip", "Didn't receive the OTP?",
    "Check your spam folder, then use Resend OTP (disabled for 30 seconds after each send to prevent spam). If you're in a local / test environment where email isn't configured, ask your admin to read the code directly from the OTP database table.",
  )

  h2(doc, "Logging in")
  para(doc,
    "Two ways to log in on the same screen:",
  )
  bullets(doc, [
    "Email & Password — the classic flow. Forgot your password? There's a link directly under the password field.",
    "Login with OTP — enter your email, receive a code, enter the code, you're in. Useful when you can't remember your password.",
    "Single sign-on — the Google and Microsoft buttons at the bottom of the form work if your admin has enabled them.",
  ])

  // ── Browsing events ──
  h1(doc, "Finding events")
  h2(doc, "The events catalogue")
  para(doc,
    "Open /events to see every published event. Filter by text search, category, or free/paid. Every card lifts and tilts when you hover it — that's intentional, it signals you can click through.",
  )
  h2(doc, "Saving events for later")
  para(doc,
    "The heart icon on each card saves an event to your wishlist. If you aren't logged in, you'll be redirected to log in first and sent back to where you were. Your saved events live at /dashboard/saved.",
  )

  // ── Registering ──
  h1(doc, "Registering for an event")
  h2(doc, "Free event — the short path")
  steps(doc, [
    "Open the event page. The sidebar shows \"Register for Free\". Click it.",
    "Step 1 of the wizard — pick a ticket type (most free events have only one).",
    "Step 2 — your name, email and phone are pre-filled if you're logged in. Fill any custom form fields the organizer has added.",
    "Step 3 — review your details, tick the Terms & Conditions checkbox, click Confirm Registration.",
    "The success screen shows the event title, date, venue, a QR code, and an Add to Calendar button. A confirmation email is sent.",
  ])
  h2(doc, "Paid event with a coupon")
  steps(doc, [
    "On Step 1, pick a ticket type. A Coupon Code field appears below.",
    "Enter the code and click Apply. If valid, you'll see the discount applied to the total.",
    "Complete Steps 2 and 3 as above. On the Review step, the button reads \"Pay ₹ NNN\" with your total after discount.",
    "The Razorpay payment sheet opens. Use your card, UPI, or net banking to pay.",
    "After a successful payment, the success screen appears and your ticket is generated. Both the payment and the ticket can be found in /dashboard/payments and /dashboard/tickets.",
  ])
  callout(doc, "warn", "Payment couldn't be completed?",
    "If the Razorpay sheet closes without a successful payment, your registration sits in the Pending state. Go to /dashboard/payments and click Retry Payment on the row — the same Razorpay order is re-used, so you won't be double-charged.",
  )

  h2(doc, "Team events")
  para(doc,
    "Some events allow team registration. On the event page you'll see \"Team registration · 2-4 members\" (or whatever the size limit is). During registration you either:",
  )
  bullets(doc, [
    "Create a team — give it a name and you're given an invite code (e.g. AB7C-3XZP). Share the code with your teammates. The code expires at the event's end date.",
    "Join a team — enter a code given to you by the team leader. If the team isn't already full and the code hasn't expired, you're added and you show up in the leader's team roster.",
  ])

  // ── Dashboard ──
  h1(doc, "Your dashboard")
  para(doc,
    "Once logged in, /dashboard is your home. The top row shows animated counters — events registered, active tickets, certificates earned, total spent. Below is a list of your upcoming events with a \"Tomorrow\" / \"in 3 days\" / \"Starting soon\" countdown for anything close.",
  )
  kvTable(doc, [
    { k: "/dashboard/events", v: "Every event you've registered for — upcoming, past, and cancelled. Cancel from here if the event hasn't started." },
    { k: "/dashboard/tickets", v: "Every active ticket. Click one to see the full-screen QR to show at the door. Download as PDF or add to calendar." },
    { k: "/dashboard/saved", v: "Events you've hearted but haven't registered for yet." },
    { k: "/dashboard/certificates", v: "Certificates issued to you after attending an event." },
    { k: "/dashboard/payments", v: "All payments made through EventFlow, with status and receipts." },
    { k: "/dashboard/profile", v: "Your personal details, avatar, and linked social accounts." },
    { k: "/dashboard/settings", v: "Notification preferences, password change, 2FA." },
  ], 160)

  // ── At the venue ──
  h1(doc, "At the venue")
  para(doc,
    "Pull up /dashboard/tickets and tap the ticket for the event you're at. Tap \"Full-screen QR\". The gate / check-in team scans it and you're checked in.",
  )
  callout(doc, "tip", "No signal at the venue?",
    "Tickets are cached offline. Even with no internet, /dashboard/tickets loads your last-synced tickets and the QR renders. An amber banner explains you're offline — the QR still works, because the signature in it is validated on the server's side when the scanner comes back online.",
  )

  // ── Organizer basics ──
  doc.addPage()
  h1(doc, "For organizers — the basics")
  para(doc,
    "If you plan to run events on EventFlow, you'll first need an organization. Organizations live underneath \"enterprises\" (one enterprise can contain many orgs — e.g. a university with clubs and departments), but you can also create a standalone org.",
  )
  h2(doc, "Creating your organization")
  steps(doc, [
    "Sign up and verify your email as above.",
    "Go to /admin/create-org. Fill in the organization's name, URL slug, category (technical / cultural / sports / etc.), contact email, and optional description.",
    "On submit, your user is upgraded to Org Admin of that organization. The sidebar now shows the Context Switcher with your org active.",
  ])
  para(doc, "Per-user limit: ten self-service organizations. Contact support if you need to exceed it.", { muted: true })

  h2(doc, "Creating an event")
  para(doc, "From /admin/org/events, click Create Event. The wizard has six steps:")
  kvTable(doc, [
    { k: "1. Basic", v: "Title, event URL (slug), visibility, category, tags, short and long descriptions." },
    { k: "2. Date & Venue", v: "Start / end, timezone, in-person venue or online (Zoom / Teams / custom URL)." },
    { k: "3. Tickets", v: "Ticket types with price, total tickets available, max tickets per person, optional sale window." },
    { k: "4. Form", v: "Custom form fields — text, select, checkbox, file upload — asked during registration." },
    { k: "5. Media", v: "Cover image, gallery, FAQs, sponsors, rules / terms / refund policy." },
    { k: "6. Review", v: "Everything on one screen. Preview button opens the public event page with a yellow \"Preview mode\" banner." },
  ], 110)
  para(doc,
    "When you're happy, click Publish Event. A confirmation dialog asks if you're sure — publishing is visible to the whole internet. Publish again after edits; the URL stays the same.",
  )

  h2(doc, "Running the event")
  para(doc,
    "Once registrations start coming in, /admin/org/events/[id] becomes your command center. Tabs cover Overview, Registrations, Check-In, Communications, Analytics. On the day of the event, open the Check-In tab on a phone or tablet connected to the camera — scan each person's QR, it auto-validates against our signed ticket format and admits them.",
  )

  // ── Troubleshooting ──
  h1(doc, "Troubleshooting")
  kvTable(doc, [
    { k: "\"Event is full\"", v: "You tried to register after the last seat was taken. If the event has a waitlist, your registration is added there and you'll be promoted automatically if someone cancels." },
    { k: "\"You are already registered for this event\"", v: "A registration for your account already exists. Check /dashboard/events — it's probably in Pending or Confirmed there." },
    { k: "QR won't scan at the venue", v: "Ask the check-in person to use Manual mode and look up your registration number. Your ticket is still valid." },
    { k: "Forgot password", v: "/forgot-password — enter your email, check for a 6-digit OTP, set a new password." },
    { k: "Can't see an event you were registered for", v: "It may have been cancelled. Cancelled events disappear from /dashboard/saved but persist in /dashboard/events under the Cancelled tab." },
  ], 180)

  // ── Where to get help ──
  h1(doc, "Where to get help")
  para(doc,
    "Every event page has the organizer's contact email in the sidebar. Platform-level issues — your account is locked, a payment didn't reach the organizer, a certificate isn't showing up — go to /contact and submit a ticket with the details.",
  )

  // Finalise first-page footer (the pageAdded hook only fires on subsequent pages).
  doc.end()
  return new Promise<void>((resolve) => stream.on("finish", () => resolve()))
}

// ─── PDF 2: Admin / Role reference ────────────────────────────────────────
function buildAdminReference(outPath: string) {
  const doc = newDoc({
    title: "EventFlow — Admin & Role Reference",
    subject: "Function and URL map by RBAC role",
  })
  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  coverPage(doc, {
    eyebrow: "Admin Reference",
    title: "Who does what, where.",
    subtitle: "Every administrative feature in EventFlow, mapped to the role that owns it and the URL you reach it from.",
    footer: `Revision 1.0  ·  Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
  })

  // ── Role hierarchy ──
  doc.addPage()
  h1(doc, "Role hierarchy at a glance")
  para(doc,
    "EventFlow has nine roles. Each user has one \"global\" role — their default power level when they're not acting inside a specific enterprise or organization. When they enter an org (by visiting /admin/org), the role is re-derived from their membership in that org. So a user can be Event Manager inside one org and Viewer inside another.",
  )
  kvTable(doc, [
    { k: "Super Admin", v: "Platform operator. Sees every enterprise, org, user, payment, audit log across every tenant. Only role with /super-admin access." },
    { k: "Enterprise Admin", v: "Owns an enterprise (e.g. a university). Creates and deletes orgs inside it, manages billing, sees cross-org analytics." },
    { k: "Enterprise Manager", v: "Enterprise admin minus billing and delete. Reads everything, writes most things inside the enterprise." },
    { k: "Org Admin", v: "Full read/write inside a single organization. Creates events, invites members, sets up payments and coupons, manages the org's website." },
    { k: "Event Manager", v: "Creates and runs events, edits registration forms, sends communications. No billing access, no member management." },
    { k: "Coordinator", v: "Day-of-event operations: check people in, see the live attendee list. Read-only everywhere else." },
    { k: "Finance Manager", v: "Payments-focused. Refunds, financial reports, coupons, payments analytics. Reads events and registrations but doesn't edit them." },
    { k: "Viewer", v: "Read-only across events, registrations, payments (amounts only), check-ins, basic analytics. Cannot change anything." },
    { k: "User", v: "Default attendee role. No admin access. Gets /dashboard and the public-facing app." },
  ], 140)

  // ── Core URL map ──
  doc.addPage()
  h1(doc, "Key routes")
  h2(doc, "Public (logged-in or anonymous)")
  kvTable(doc, [
    { k: "/", v: "Marketing landing page with the WebGL hero." },
    { k: "/events", v: "Public events catalogue." },
    { k: "/events/[slug]", v: "Individual event page. Sidebar shows registration CTA; returning users see a \"You're registered\" badge." },
    { k: "/events/[slug]/register", v: "Three-step registration wizard ending in a success screen with QR + add-to-calendar." },
    { k: "/events/[slug]/feedback", v: "Post-event feedback form. Accessible after the event has started." },
    { k: "/verify/[code]", v: "Public certificate / ticket verification by code — anyone can check authenticity." },
  ], 180)

  h2(doc, "Attendee dashboard")
  kvTable(doc, [
    { k: "/dashboard", v: "Counters, upcoming events, quick actions." },
    { k: "/dashboard/events", v: "My registrations — upcoming / past / cancelled tabs." },
    { k: "/dashboard/tickets", v: "Active tickets with full-screen QR. Cached offline." },
    { k: "/dashboard/saved", v: "Wishlisted events." },
    { k: "/dashboard/certificates", v: "Issued certificates, downloadable." },
    { k: "/dashboard/payments", v: "Payment history and receipts." },
    { k: "/dashboard/profile", v: "Personal details." },
    { k: "/dashboard/settings", v: "Notifications, password, 2FA." },
    { k: "/dashboard/notifications", v: "Inbox for platform notifications." },
  ], 180)

  h2(doc, "Organization admin (/admin/org/*)")
  kvTable(doc, [
    { k: "/admin/org", v: "Org dashboard — counters, recent activity, upcoming events." },
    { k: "/admin/org/events", v: "Events list. Three-dot menu on each row: View, Edit, Registrations, Check-in, Duplicate, Cancel." },
    { k: "/admin/org/events/create", v: "Six-step event creation wizard." },
    { k: "/admin/org/events/[id]/edit", v: "Same wizard against an existing event." },
    { k: "/admin/org/events/[id]/registrations", v: "Registrations table with search, status filter, manual approve / reject, CSV export." },
    { k: "/admin/org/events/[id]/check-in", v: "QR scanner + manual lookup + live stats dashboard." },
    { k: "/admin/org/events/[id]/analytics", v: "Funnel, conversion, geography, ticket-type breakdown." },
    { k: "/admin/org/registrations", v: "All registrations across all events in the org." },
    { k: "/admin/org/payments", v: "Payments across all events. Click a row to refund." },
    { k: "/admin/org/members", v: "Team members of the organization. Invite, change role, remove." },
    { k: "/admin/org/communications", v: "Email campaigns to registrants, announcements, message templates." },
    { k: "/admin/org/certificates", v: "Certificate templates + bulk issuance for past events." },
    { k: "/admin/org/coupons", v: "Discount codes — percentage / fixed, usage limits, validity window, event scope." },
    { k: "/admin/org/analytics", v: "Org-wide reporting." },
    { k: "/admin/org/audit-logs", v: "Every write action in the org with actor, target, timestamp, IP." },
    { k: "/admin/org/website", v: "Website builder home — pick a template or open the editor." },
    { k: "/admin/org/website/editor", v: "Drag-and-drop visual editor with live preview." },
    { k: "/admin/org/website/modules", v: "Feature modules — quiz, poll, blog, leaderboard, gallery, etc. Enable / configure." },
    { k: "/admin/org/website/media", v: "Media library for images used across the website." },
    { k: "/admin/org/settings", v: "Org name, branding, payment settings, notification settings." },
  ], 210)

  h2(doc, "Enterprise admin (/admin/enterprise/*)")
  kvTable(doc, [
    { k: "/admin/enterprise", v: "Cross-org dashboard." },
    { k: "/admin/enterprise/organizations", v: "All orgs inside the enterprise. Create / deactivate." },
    { k: "/admin/enterprise/members", v: "Enterprise-level team (admins / managers)." },
    { k: "/admin/enterprise/payments", v: "Cross-org payment and revenue view." },
    { k: "/admin/enterprise/billing", v: "Subscription plan, invoices, payment method (Enterprise Admin only)." },
    { k: "/admin/enterprise/settings", v: "Enterprise branding, domain, defaults." },
  ], 210)

  h2(doc, "Super admin (/super-admin/*)")
  kvTable(doc, [
    { k: "/super-admin", v: "Platform KPIs." },
    { k: "/super-admin/enterprises", v: "All enterprises. Verify, suspend, impersonate." },
    { k: "/super-admin/organizations", v: "All orgs across all enterprises." },
    { k: "/super-admin/events", v: "Every event on the platform." },
    { k: "/super-admin/users", v: "All users. Ban, change role, impersonate." },
    { k: "/super-admin/subscriptions", v: "Subscription plans + assignments." },
    { k: "/super-admin/analytics", v: "Platform-wide analytics." },
    { k: "/super-admin/audit", v: "Platform-wide audit log." },
    { k: "/super-admin/messages", v: "Contact-form inbox." },
    { k: "/super-admin/settings", v: "Global platform settings, feature flags." },
  ], 210)

  // ── Permission matrix ──
  doc.addPage()
  h1(doc, "Who can do what")
  para(doc,
    "The system has ~60 granular permissions. The most common ones and which roles hold them, in order of severity:",
  )

  const ok = "●"
  const cross = "○"
  const denseRow = (title: string, roles: string) => ({ k: title, v: roles })

  h3(doc, "Event lifecycle")
  kvTable(doc, [
    denseRow("Create event", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  Coord ${cross}  Finance ${cross}  Viewer ${cross}`),
    denseRow("Publish event", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  Coord ${cross}  Finance ${cross}  Viewer ${cross}`),
    denseRow("Cancel event", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  Coord ${cross}  Finance ${cross}  Viewer ${cross}`),
    denseRow("Delete event", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${cross}  Org-Adm ${cross}  Event-Mgr ${cross}  Coord ${cross}  Finance ${cross}  Viewer ${cross}`),
    denseRow("Duplicate event", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  Coord ${cross}  Finance ${cross}  Viewer ${cross}`),
  ], 150)

  h3(doc, "Registrations")
  kvTable(doc, [
    denseRow("View registrations", `All admin roles ${ok}`),
    denseRow("Approve / reject", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  others ${cross}`),
    denseRow("Manually add registration", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  others ${cross}`),
    denseRow("Export CSV", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  others ${cross}`),
  ], 150)

  h3(doc, "Payments")
  kvTable(doc, [
    denseRow("View payments", `All admin roles ${ok}`),
    denseRow("Process refund", `Super ${ok}  Ent-Adm ${ok}  Org-Adm ${ok}  Finance ${ok}  others ${cross}`),
    denseRow("View financial reports", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Finance ${ok}  Viewer ${cross}`),
    denseRow("Export payment data", `Super ${ok}  Ent-Adm ${ok}  Org-Adm ${ok}  Finance ${ok}  others ${cross}`),
  ], 150)

  h3(doc, "Check-in")
  kvTable(doc, [
    denseRow("Scan QR / manual check-in", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Coord ${ok}  Event team ${ok}`),
    denseRow("View check-in stats", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  Event-Mgr ${ok}  Coord ${ok}  Viewer ${ok}`),
    denseRow("Undo a check-in", `Super ${ok}  Ent-Adm ${ok}  Org-Adm ${ok}  Coord (within 5 min)`),
  ], 150)

  h3(doc, "Members & roles")
  kvTable(doc, [
    denseRow("Invite org member", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  others ${cross}`),
    denseRow("Change member role", `Super ${ok}  Ent-Adm ${ok}  Org-Adm ${ok}  others ${cross}`),
    denseRow("Remove member", `Super ${ok}  Ent-Adm ${ok}  Org-Adm ${ok}  others ${cross}`),
  ], 150)

  h3(doc, "Website builder")
  kvTable(doc, [
    denseRow("Edit sections / styles", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  others ${cross}`),
    denseRow("Enable / configure modules", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  others ${cross}`),
    denseRow("Publish website", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  others ${cross}`),
  ], 150)

  h3(doc, "Audit")
  kvTable(doc, [
    denseRow("View audit log", `Super ${ok}  Ent-Adm ${ok}  Ent-Mgr ${ok}  Org-Adm ${ok}  others ${cross}`),
    denseRow("Export audit log", `Super ${ok}  Ent-Adm ${ok}  others ${cross}`),
  ], 150)

  // ── Day-in-the-life walkthroughs ──
  doc.addPage()
  h1(doc, "Day-in-the-life walkthroughs")

  h2(doc, "Org Admin runs a new event end-to-end")
  steps(doc, [
    "/admin/org/events → Create Event. Fill the six-step wizard.",
    "On Step 6, click Preview — the event opens in a new tab with a yellow Preview mode banner so you can check the public experience.",
    "Back in the wizard, click Publish Event. Confirm the dialog.",
    "/admin/org/coupons → create an early-bird coupon for this event.",
    "/admin/org/communications → compose an announcement email with the event link; send to a target list (your members, past attendees, or a custom CSV).",
    "As registrations land, /admin/org/events/[id]/registrations shows them live. Approve pending registrations in bulk if approval is required.",
    "On event day, load /admin/org/events/[id]/check-in on a tablet and scan QRs. Live stats update beside the scanner.",
    "After the event, go to /admin/org/certificates → bulk-issue certificates to attendees. They'll appear in each user's /dashboard/certificates.",
    "Review the debrief on /admin/org/events/[id]/analytics.",
  ])

  h2(doc, "Finance Manager issues a refund")
  steps(doc, [
    "/admin/org/payments → search by registration number or email.",
    "Click the payment row. A detail drawer opens with the original amount, method, gateway transaction ID.",
    "Click Process Refund. Enter amount (defaults to full), reason, click Confirm.",
    "The refund is marked COMPLETED, the associated registration is cancelled, any coupon use is decremented, the user is notified, and the audit log records who did what.",
  ])

  h2(doc, "Coordinator covers the door on event day")
  steps(doc, [
    "/admin/org/events/[id]/check-in on a phone / tablet.",
    "Tap QR Scan. Allow camera access the first time.",
    "Point at each attendee's QR on their phone. A green banner confirms the check-in.",
    "If someone's QR is broken, tap Manual and search by name, email, or registration number. Click Check-in on the matching row.",
    "Live stats update at the top — total expected, checked-in, percentage.",
  ])

  h2(doc, "Enterprise Admin adds a new org")
  steps(doc, [
    "/admin/enterprise/organizations → New Organization.",
    "Fill name, slug, category, contact email; pick an owner from your enterprise members (or invite one).",
    "On save, the org appears in the sidebar's Context Switcher, and its Org Admin can start creating events immediately.",
  ])

  h2(doc, "Super Admin investigates a reported user")
  steps(doc, [
    "/super-admin/users → search by email.",
    "Click the user row. See their role, orgs, registrations, payments, login history.",
    "If action is needed: Suspend (reversible, they can't log in), Ban (irreversible without manual unban), or Change Role.",
    "/super-admin/audit → filter to that user's ID to see every action they've taken.",
  ])

  // ── Appendices ──
  doc.addPage()
  h1(doc, "Appendix — full permission list")
  para(doc, "Grouped by resource. Format: permission constant → who holds it (by default).", { muted: true })

  const permGroups: Array<{ group: string; perms: Array<[string, string]> }> = [
    { group: "Enterprise", perms: [
      ["enterprise:view", "Super, Ent-Adm, Ent-Mgr"],
      ["enterprise:edit", "Super, Ent-Adm, Ent-Mgr"],
      ["enterprise:delete", "Super, Ent-Adm"],
      ["enterprise:manage_billing", "Super, Ent-Adm"],
      ["enterprise:view_analytics", "Super, Ent-Adm, Ent-Mgr"],
      ["enterprise:export_data", "Super, Ent-Adm, Ent-Mgr"],
    ]},
    { group: "Organization", perms: [
      ["org:create", "Super, Ent-Adm, Ent-Mgr"],
      ["org:view", "All admin roles"],
      ["org:edit", "Super, Ent-Adm, Ent-Mgr, Org-Adm"],
      ["org:delete", "Super, Ent-Adm, Ent-Mgr"],
      ["org:manage_settings", "Super, Ent-Adm, Org-Adm"],
      ["org:view_analytics", "Super, Ent-Adm, Ent-Mgr, Org-Adm"],
    ]},
    { group: "Events", perms: [
      ["event:create", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr"],
      ["event:edit", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr"],
      ["event:publish", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr"],
      ["event:cancel", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr"],
      ["event:delete", "Super, Ent-Adm"],
      ["event:duplicate", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr"],
    ]},
    { group: "Registrations", perms: [
      ["registration:view", "All admin roles"],
      ["registration:manage", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr"],
      ["registration:approve", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr"],
      ["registration:export", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Event-Mgr, Finance"],
    ]},
    { group: "Payments", perms: [
      ["payment:view", "All admin roles"],
      ["payment:manage", "Super, Ent-Adm, Org-Adm, Finance"],
      ["payment:refund", "Super, Ent-Adm, Org-Adm, Finance"],
      ["payment:view_reports", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Finance"],
    ]},
    { group: "Check-in", perms: [
      ["checkin:perform", "Super, Ent-Adm, Ent-Mgr, Org-Adm, Coord, event team"],
      ["checkin:view", "All admin roles"],
      ["checkin:manage", "Super, Ent-Adm, Ent-Mgr, Org-Adm"],
      ["checkin:undo", "Super, Ent-Adm, Org-Adm, Coord"],
    ]},
    { group: "Audit", perms: [
      ["audit:view", "Super, Ent-Adm, Ent-Mgr, Org-Adm"],
      ["audit:export", "Super, Ent-Adm"],
    ]},
  ]

  for (const g of permGroups) {
    h3(doc, g.group)
    kvTable(doc, g.perms.map(([k, v]) => ({ k, v })), 200)
  }

  h1(doc, "Appendix — the environment variables you'll need")
  para(doc, "Any production deployment needs the following populated — at minimum.", { muted: true })
  kvTable(doc, [
    { k: "DATABASE_URL", v: "Postgres (Supabase or your own) connection string." },
    { k: "NEXTAUTH_SECRET", v: "32+ char random string used to sign JWTs." },
    { k: "NEXTAUTH_URL", v: "The public URL your app is served at." },
    { k: "RESEND_API_KEY", v: "Transactional email provider API key." },
    { k: "EMAIL_FROM", v: "From-address. Refuses to send in prod without it, so SPF/DKIM pass." },
    { k: "TICKET_SECRET", v: "32+ char HMAC secret used to sign QR payloads." },
    { k: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET", v: "Payment gateway credentials (India). Test keys work in dev." },
    { k: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET", v: "For Sign in with Google." },
    { k: "MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET", v: "For Sign in with Microsoft." },
    { k: "REDIS_URL", v: "Optional. Unlocks proper rate-limiting and background email queue." },
  ], 260)

  doc.end()
  return new Promise<void>((resolve) => stream.on("finish", () => resolve()))
}

// ─── Entry ────────────────────────────────────────────────────────────────
async function main() {
  const outDir = path.join(process.cwd(), "docs")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const userGuide = path.join(outDir, "user-guide.pdf")
  const adminRef  = path.join(outDir, "admin-reference.pdf")

  console.log("📄 Building PDFs...")
  await buildUserGuide(userGuide)
  console.log(`  ✓ ${userGuide}`)
  await buildAdminReference(adminRef)
  console.log(`  ✓ ${adminRef}`)
  console.log("\n✅ Done.")
}

main().catch((e) => { console.error(e); process.exit(1) })
