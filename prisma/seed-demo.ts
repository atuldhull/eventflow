/**
 * Demo-run seed. Populates the app with fake users (all roles), orgs, events
 * in various states, registrations, tickets, payments, and saved events — so
 * every part of the UI has something to show.
 *
 * Every user's password is `Welcome@123`. All emails are pre-verified so
 * you log in by password directly (no OTP email round-trip).
 *
 * Safe to re-run: every write is upsert on a stable unique key.
 *
 * Run with:  npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const prisma = new PrismaClient()

const PASSWORD = "Welcome@123"

const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000)

async function upsertUser(opts: {
  email: string
  name: string
  role: "SUPER_ADMIN" | "ENTERPRISE_ADMIN" | "ENTERPRISE_MANAGER" | "ORG_ADMIN" | "EVENT_MANAGER" | "COORDINATOR" | "FINANCE_MANAGER" | "VIEWER" | "USER"
  avatar?: string
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  return prisma.user.upsert({
    where: { email: opts.email },
    update: { name: opts.name, role: opts.role, emailVerified: new Date(), isActive: true, isBanned: false },
    create: {
      email: opts.email, name: opts.name, passwordHash,
      role: opts.role, emailVerified: new Date(), avatar: opts.avatar,
    },
  })
}

async function main() {
  console.log("🎬 Demo seed starting...\n")

  // Ensure base seed has run.
  const techClub = await prisma.organization.findUnique({ where: { slug: "tech-club" } })
  const cultural = await prisma.organization.findUnique({ where: { slug: "cultural-society" } })
  const enterprise = await prisma.enterprise.findUnique({ where: { slug: "demo-university" } })
  if (!techClub || !cultural || !enterprise) {
    console.error("✗ Base seed missing. Run `npx prisma db seed` first.")
    process.exit(1)
  }

  // ── Extra org: Robotics Lab ──────────────────────────────────────────────
  const robotics = await prisma.organization.upsert({
    where: { slug: "robotics-lab" },
    update: {},
    create: {
      name: "Robotics Lab",
      slug: "robotics-lab",
      email: "robotics@demo-university.edu",
      category: "TECHNICAL",
      enterpriseId: enterprise.id,
      description: "Hands-on robotics + electronics for undergrads.",
    },
  })

  // ── Users ────────────────────────────────────────────────────────────────
  console.log("👤 Users")

  const you = await upsertUser({ email: "you@gmail.com", name: "You (Demo Reviewer)", role: "SUPER_ADMIN" })
  const entAdmin = await upsertUser({ email: "enterprise.owner@gmail.com", name: "Priya Sharma", role: "ENTERPRISE_ADMIN" })
  const orgAdmin = await upsertUser({ email: "org.admin@gmail.com", name: "Rohan Mehta", role: "ORG_ADMIN" })
  const eventMgr = await upsertUser({ email: "event.manager@gmail.com", name: "Aarav Kapoor", role: "EVENT_MANAGER" })
  const coordinator = await upsertUser({ email: "coordinator@gmail.com", name: "Sneha Iyer", role: "COORDINATOR" })
  const finance = await upsertUser({ email: "finance@gmail.com", name: "Vikram Rao", role: "FINANCE_MANAGER" })
  const viewer = await upsertUser({ email: "viewer@gmail.com", name: "Anjali Nair", role: "VIEWER" })

  const alice = await upsertUser({ email: "alice.student@gmail.com", name: "Alice Mukherjee", role: "USER" })
  const bob = await upsertUser({ email: "bob.hacker@gmail.com", name: "Bob Srinivasan", role: "USER" })
  const charlie = await upsertUser({ email: "charlie.dev@gmail.com", name: "Charlie Pillai", role: "USER" })
  const diana = await upsertUser({ email: "diana.designer@gmail.com", name: "Diana Fernandes", role: "USER" })
  const eve = await upsertUser({ email: "eve.intern@gmail.com", name: "Eve Banerjee", role: "USER" })
  console.log("  ✓ 12 users upserted (password for all: Welcome@123)")

  // ── Memberships ──────────────────────────────────────────────────────────
  console.log("🔗 Memberships")

  // Enterprise ownership
  await prisma.enterpriseMember.upsert({
    where: { enterpriseId_userId: { enterpriseId: enterprise.id, userId: entAdmin.id } },
    update: { role: "ENTERPRISE_ADMIN", isActive: true },
    create: { enterpriseId: enterprise.id, userId: entAdmin.id, role: "ENTERPRISE_ADMIN", isActive: true },
  })

  // Org memberships
  const orgMemberships: Array<{ userId: string; orgId: string; role: string }> = [
    { userId: you.id, orgId: techClub.id, role: "ORG_ADMIN" },
    { userId: you.id, orgId: robotics.id, role: "ORG_ADMIN" },
    { userId: orgAdmin.id, orgId: techClub.id, role: "ORG_ADMIN" },
    { userId: eventMgr.id, orgId: techClub.id, role: "EVENT_MANAGER" },
    { userId: coordinator.id, orgId: techClub.id, role: "COORDINATOR" },
    { userId: finance.id, orgId: techClub.id, role: "FINANCE_MANAGER" },
    { userId: viewer.id, orgId: techClub.id, role: "VIEWER" },
  ]
  for (const m of orgMemberships) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: m.orgId, userId: m.userId } },
      update: { role: m.role as "ORG_ADMIN", isActive: true },
      create: { organizationId: m.orgId, userId: m.userId, role: m.role as "ORG_ADMIN", isActive: true },
    })
  }
  console.log(`  ✓ ${orgMemberships.length} org memberships + 1 enterprise membership`)

  // ── Events ───────────────────────────────────────────────────────────────
  console.log("📅 Events")

  const freeEvent = await prisma.event.upsert({
    where: { slug: "hack-night-2026" },
    update: { status: "PUBLISHED" },
    create: {
      title: "Tech Club Hack Night",
      slug: "hack-night-2026",
      description: "A relaxed evening of hacking, pizza, and lightning talks. Bring a laptop, bring an idea, leave with a prototype. No prior experience required — mentors will be on the floor all night.",
      shortDescription: "Pizza, prototypes, and lightning talks — no prior experience needed.",
      status: "PUBLISHED",
      type: "SINGLE",
      visibility: "PUBLIC",
      category: "TECH",
      tags: ["hackathon", "students", "beginner-friendly"],
      startDate: inDays(14),
      endDate: new Date(inDays(14).getTime() + 5 * 60 * 60 * 1000),
      timezone: "Asia/Kolkata",
      venue: "CS Block, Lab 3",
      venueAddress: "Demo University, CS Block",
      venueCity: "Bengaluru",
      venueState: "Karnataka",
      venueCountry: "India",
      isOnline: false,
      isPaid: false,
      isFeatured: true,
      maxCapacity: 100,
      waitlistEnabled: true,
      organizationId: techClub.id,
      createdById: orgAdmin.id,
      publishedAt: new Date(),
      contactEmail: "tech@demo-university.edu",
      ticketTypes: { create: [{ name: "General Admission", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }] },
    },
  })

  const paidEvent = await prisma.event.upsert({
    where: { slug: "web-dev-workshop-2026" },
    update: { status: "PUBLISHED" },
    create: {
      title: "Web Dev Workshop: Build a SaaS in a Day",
      slug: "web-dev-workshop-2026",
      description: "A hands-on one-day workshop where we build a production-ready SaaS from scratch. Covers Next.js, Prisma, auth, payments, and deploying to the cloud. Materials included.",
      shortDescription: "Hands-on workshop: build a production SaaS in one day.",
      status: "PUBLISHED",
      type: "SINGLE",
      visibility: "PUBLIC",
      category: "WORKSHOP",
      tags: ["nextjs", "workshop", "hands-on"],
      startDate: inDays(30),
      endDate: new Date(inDays(30).getTime() + 8 * 60 * 60 * 1000),
      timezone: "Asia/Kolkata",
      venue: "Innovation Hub",
      venueAddress: "Demo University, Innovation Hub 2nd Floor",
      venueCity: "Bengaluru",
      isOnline: false,
      isPaid: true,
      maxCapacity: 50,
      organizationId: techClub.id,
      createdById: orgAdmin.id,
      publishedAt: new Date(),
      contactEmail: "tech@demo-university.edu",
      ticketTypes: { create: [
        { name: "Early Bird", price: 499, currency: "INR", quantity: 25, sold: 0, maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0, description: "First 25 seats — a steal." },
        { name: "Regular", price: 799, currency: "INR", quantity: 25, sold: 0, maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 1 },
      ] },
    },
  })

  const teamEvent = await prisma.event.upsert({
    where: { slug: "annual-robofest-2026" },
    update: {},
    create: {
      title: "Annual RoboFest 2026",
      slug: "annual-robofest-2026",
      description: "The flagship robotics competition of Demo University. Teams of 2-4 build autonomous robots to solve a new challenge revealed at kickoff. Prize pool ₹50,000.",
      shortDescription: "Team robotics competition with ₹50k prize pool.",
      status: "PUBLISHED",
      type: "SINGLE",
      visibility: "PUBLIC",
      category: "COMPETITION",
      tags: ["robotics", "competition", "teams"],
      startDate: inDays(45),
      endDate: new Date(inDays(46).getTime()),
      timezone: "Asia/Kolkata",
      venue: "Robotics Arena",
      venueCity: "Bengaluru",
      isOnline: false,
      isPaid: true,
      maxCapacity: 30,
      allowTeamRegistration: true,
      minTeamSize: 2,
      maxTeamSize: 4,
      organizationId: robotics.id,
      createdById: you.id,
      publishedAt: new Date(),
      ticketTypes: { create: [{ name: "Team Entry", price: 999, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0, description: "Per-team entry fee (2-4 members)." }] },
    },
  })

  const onlineEvent = await prisma.event.upsert({
    where: { slug: "ux-design-online-2026" },
    update: {},
    create: {
      title: "UX Design Fundamentals — Live Online",
      slug: "ux-design-online-2026",
      description: "A free online introduction to UX design principles. Join from anywhere; replay available for registrants.",
      shortDescription: "Free online UX workshop — join from anywhere.",
      status: "PUBLISHED",
      type: "VIRTUAL",
      visibility: "PUBLIC",
      category: "WORKSHOP",
      tags: ["ux", "online", "free"],
      startDate: inDays(7),
      endDate: new Date(inDays(7).getTime() + 2 * 60 * 60 * 1000),
      timezone: "Asia/Kolkata",
      isOnline: true,
      onlinePlatform: "Zoom",
      isPaid: false,
      maxCapacity: 500,
      organizationId: cultural.id,
      createdById: orgAdmin.id,
      publishedAt: new Date(),
      ticketTypes: { create: [{ name: "Free Access", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }] },
    },
  })

  const draftEvent = await prisma.event.upsert({
    where: { slug: "leadership-summit-2026" },
    update: {},
    create: {
      title: "Leadership Summit 2026",
      slug: "leadership-summit-2026",
      description: "An invitation-only gathering of student-body leaders across the university. Speakers, workshops, and networking over 2 days.",
      shortDescription: "Invitation-only leadership gathering, 2 days.",
      status: "DRAFT",
      type: "MULTI_DAY",
      visibility: "INVITE_ONLY",
      category: "CONFERENCE",
      startDate: inDays(60),
      endDate: inDays(62),
      timezone: "Asia/Kolkata",
      venue: "Main Auditorium",
      venueCity: "Bengaluru",
      isOnline: false,
      isPaid: false,
      organizationId: techClub.id,
      createdById: orgAdmin.id,
      ticketTypes: { create: [{ name: "Invited Delegate", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }] },
    },
  })

  const ongoingEvent = await prisma.event.upsert({
    where: { slug: "coding-contest-live" },
    update: {},
    create: {
      title: "24-Hour Coding Contest — Live",
      slug: "coding-contest-live",
      description: "A 24-hour algorithmic coding contest. Live leaderboard, prizes for top 3.",
      shortDescription: "24-hour algorithmic contest happening now.",
      status: "ONGOING",
      type: "SINGLE",
      visibility: "PUBLIC",
      category: "COMPETITION",
      startDate: inDays(-0.5),  // started 12h ago
      endDate: inDays(0.5),     // ends 12h from now
      timezone: "Asia/Kolkata",
      venue: "CS Block, Lab 1",
      venueCity: "Bengaluru",
      isOnline: false,
      isPaid: false,
      maxCapacity: 80,
      organizationId: techClub.id,
      createdById: orgAdmin.id,
      publishedAt: inDays(-7),
      ticketTypes: { create: [{ name: "Contestant", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }] },
    },
  })

  const completedEvent = await prisma.event.upsert({
    where: { slug: "cultural-fest-2025" },
    update: {},
    create: {
      title: "Cultural Fest 2025",
      slug: "cultural-fest-2025",
      description: "Our annual cultural extravaganza — music, dance, drama, food. 3 unforgettable days.",
      shortDescription: "3 days of music, dance, and food — annual cultural fest.",
      status: "COMPLETED",
      type: "MULTI_DAY",
      visibility: "PUBLIC",
      category: "CULTURAL",
      startDate: inDays(-90),
      endDate: inDays(-87),
      timezone: "Asia/Kolkata",
      venue: "University Grounds",
      venueCity: "Bengaluru",
      isOnline: false,
      isPaid: false,
      maxCapacity: 2000,
      organizationId: cultural.id,
      createdById: orgAdmin.id,
      publishedAt: inDays(-120),
      ticketTypes: { create: [{ name: "General Entry", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 }] },
    },
  })
  console.log("  ✓ 7 events (free, paid, team, online, DRAFT, ONGOING, COMPLETED)")

  // ── Event team: coordinator on the ongoing event (so they can check people in) ─
  await prisma.eventTeamMember.upsert({
    where: { eventId_userId: { eventId: ongoingEvent.id, userId: coordinator.id } },
    update: { role: "COORDINATOR", isActive: true },
    create: { eventId: ongoingEvent.id, userId: coordinator.id, role: "COORDINATOR", isActive: true },
  })
  console.log("  ✓ coordinator@gmail.com added as COORDINATOR on the ongoing event")

  // ── Coupon (paid event) ─────────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      isActive: true,
      validFrom: new Date(),
      validUntil: inDays(180),
      maxUses: 1000,
      currentUses: 0,
      eventId: paidEvent.id,
    },
  })
  console.log("  ✓ Coupon WELCOME10 (10% off on the paid workshop)")

  // ── Registrations / tickets / payments ───────────────────────────────────
  console.log("🎟️  Registrations")

  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: { in: [freeEvent.id, paidEvent.id, onlineEvent.id, ongoingEvent.id, completedEvent.id] } },
    orderBy: { sortOrder: "asc" },
  })
  const tt = (eventId: string) => ticketTypes.find((t) => t.eventId === eventId)!

  const regNo = () => `EVT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`
  const ticketNo = () => `TKT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const paymentNo = () => `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

  async function ensureRegistration(opts: {
    event: { id: string; slug: string }
    user: { id: string }
    ticketType: { id: string; price: unknown; currency: string }
    status: "CONFIRMED" | "PENDING" | "CHECKED_IN" | "CANCELLED" | "WAITLISTED"
    withTicket?: boolean
    withCompletedPayment?: boolean
  }) {
    const existing = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId: opts.event.id, userId: opts.user.id } },
      select: { id: true },
    })
    if (existing) return existing

    const reg = await prisma.registration.create({
      data: {
        registrationNumber: regNo(),
        eventId: opts.event.id,
        userId: opts.user.id,
        ticketTypeId: opts.ticketType.id,
        status: opts.status,
        type: "INDIVIDUAL",
        source: "SEED",
      },
    })

    if (opts.withTicket) {
      await prisma.ticket.create({
        data: {
          ticketNumber: ticketNo(),
          registrationId: reg.id,
          ticketTypeId: opts.ticketType.id,
          userId: opts.user.id,
          eventId: opts.event.id,
          status: opts.status === "CHECKED_IN" ? "USED" : "ACTIVE",
          qrCode: JSON.stringify({ v: 1, t: ticketNo(), e: opts.event.id, r: reg.registrationNumber, s: "seed" }),
        },
      })
    }

    if (opts.withCompletedPayment) {
      await prisma.payment.create({
        data: {
          paymentNumber: paymentNo(),
          registrationId: reg.id,
          userId: opts.user.id,
          eventId: opts.event.id,
          amount: Number(opts.ticketType.price),
          currency: opts.ticketType.currency,
          status: "COMPLETED",
          method: "RAZORPAY",
          paidAt: new Date(),
        },
      })
    }

    return reg
  }

  // `you@gmail.com` — realistic dashboard
  await ensureRegistration({ event: freeEvent, user: you, ticketType: tt(freeEvent.id), status: "CONFIRMED", withTicket: true })
  await ensureRegistration({ event: paidEvent, user: you, ticketType: tt(paidEvent.id), status: "CONFIRMED", withTicket: true, withCompletedPayment: true })
  await ensureRegistration({ event: completedEvent, user: you, ticketType: tt(completedEvent.id), status: "CHECKED_IN", withTicket: true })

  // Fake attendees on the free event (populates admin registrations table)
  for (const u of [alice, bob, charlie, diana, eve]) {
    await ensureRegistration({ event: freeEvent, user: u, ticketType: tt(freeEvent.id), status: "CONFIRMED", withTicket: true })
  }

  // A few on the ongoing event (for check-in demo)
  for (const u of [alice, bob, charlie]) {
    await ensureRegistration({ event: ongoingEvent, user: u, ticketType: tt(ongoingEvent.id), status: "CONFIRMED", withTicket: true })
  }

  // A few on the online event
  for (const u of [diana, eve]) {
    await ensureRegistration({ event: onlineEvent, user: u, ticketType: tt(onlineEvent.id), status: "CONFIRMED", withTicket: true })
  }

  // Keep currentRegistrations roughly in sync so capacity bars look right.
  for (const e of [freeEvent, paidEvent, onlineEvent, ongoingEvent, completedEvent]) {
    const count = await prisma.registration.count({
      where: { eventId: e.id, status: { in: ["CONFIRMED", "CHECKED_IN", "WAITLISTED"] } },
    })
    await prisma.event.update({ where: { id: e.id }, data: { currentRegistrations: count } })
  }
  console.log("  ✓ Registrations + tickets + 1 completed payment seeded; capacity counts synced")

  // ── Saved events (wishlist) for `you@gmail.com` ──────────────────────────
  for (const e of [teamEvent, onlineEvent]) {
    await prisma.savedEvent.upsert({
      where: { userId_eventId: { userId: you.id, eventId: e.id } },
      update: {},
      create: { userId: you.id, eventId: e.id },
    })
  }
  console.log("  ✓ 2 saved events on you@gmail.com")

  console.log("\n🎉 Demo seed complete.\n")
  console.log("=".repeat(72))
  console.log(" PRIMARY ACCOUNT")
  console.log("=".repeat(72))
  console.log("   you@gmail.com                 / Welcome@123   (SUPER_ADMIN + owns 2 orgs)")
  console.log("")
  console.log("=".repeat(72))
  console.log(" ROLE-BASED ACCOUNTS (all passwords: Welcome@123)")
  console.log("=".repeat(72))
  console.log("   enterprise.owner@gmail.com    ENTERPRISE_ADMIN of Demo University")
  console.log("   org.admin@gmail.com           ORG_ADMIN of Tech Club")
  console.log("   event.manager@gmail.com       EVENT_MANAGER of Tech Club")
  console.log("   coordinator@gmail.com         COORDINATOR on the ONGOING event (check-in)")
  console.log("   finance@gmail.com             FINANCE_MANAGER of Tech Club (refunds)")
  console.log("   viewer@gmail.com              VIEWER of Tech Club (read-only admin)")
  console.log("")
  console.log("=".repeat(72))
  console.log(" ATTENDEES (already registered for events)")
  console.log("=".repeat(72))
  console.log("   alice.student@gmail.com       Registered for hack-night + contest")
  console.log("   bob.hacker@gmail.com          Registered for hack-night + contest")
  console.log("   charlie.dev@gmail.com         Registered for hack-night + contest")
  console.log("   diana.designer@gmail.com      Registered for hack-night + UX online")
  console.log("   eve.intern@gmail.com          Registered for hack-night + UX online")
  console.log("")
  console.log("=".repeat(72))
  console.log(" EVENTS")
  console.log("=".repeat(72))
  console.log("   /events/hack-night-2026              free + featured (in 14d)")
  console.log("   /events/web-dev-workshop-2026        paid, coupon WELCOME10 (in 30d)")
  console.log("   /events/annual-robofest-2026         paid TEAM event (in 45d)")
  console.log("   /events/ux-design-online-2026        free ONLINE (in 7d)")
  console.log("   /events/leadership-summit-2026       DRAFT + INVITE_ONLY (preview only)")
  console.log("   /events/coding-contest-live          ONGOING — live now (check-in demo)")
  console.log("   /events/cultural-fest-2025           COMPLETED — past event")
  console.log("")
}

main()
  .catch((e) => { console.error("Demo seed failed:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
