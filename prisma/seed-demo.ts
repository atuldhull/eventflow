/**
 * Demo-run seed. Adds just enough data on top of `prisma/seed.ts` to let a
 * reviewer click through every flow without hand-typing.
 *
 * Safe to re-run: everything upserts on a stable unique key.
 *
 * Run with:   npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🎬 Demo-run seed starting...")

  // Make sure the base seed has run — we piggyback on its Tech Club org.
  const techClub = await prisma.organization.findUnique({ where: { slug: "tech-club" } })
  if (!techClub) {
    console.error("✗ Tech Club org not found. Run `npx prisma db seed` first.")
    process.exit(1)
  }

  // ── Users ────────────────────────────────────────────────────────────────
  const attendee = await prisma.user.upsert({
    where: { email: "demo@eventflow.com" },
    update: {},
    create: {
      email: "demo@eventflow.com",
      name: "Demo Attendee",
      passwordHash: await bcrypt.hash("Demo@123456", 12),
      role: "USER",
      emailVerified: new Date(),
    },
  })
  console.log("  ✓ Attendee user  demo@eventflow.com / Demo@123456")

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@eventflow.com" },
    update: {},
    create: {
      email: "organizer@eventflow.com",
      name: "Demo Organizer",
      passwordHash: await bcrypt.hash("Organizer@123456", 12),
      role: "ORG_ADMIN",
      emailVerified: new Date(),
    },
  })
  console.log("  ✓ Organizer user organizer@eventflow.com / Organizer@123456")

  // Organizer is admin of Tech Club.
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: techClub.id, userId: organizer.id } },
    update: { role: "ORG_ADMIN", isActive: true },
    create: { organizationId: techClub.id, userId: organizer.id, role: "ORG_ADMIN", isActive: true },
  })
  console.log("  ✓ Organizer linked to Tech Club as ORG_ADMIN")

  // ── Events ───────────────────────────────────────────────────────────────
  const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000)

  const freeEvent = await prisma.event.upsert({
    where: { slug: "hack-night-2026" },
    update: {},
    create: {
      title: "Tech Club Hack Night",
      slug: "hack-night-2026",
      description:
        "A relaxed evening of hacking, pizza, and lightning talks. Bring a laptop, bring an idea, leave with a prototype. No prior experience required — mentors will be on the floor all night.",
      shortDescription: "Pizza, prototypes, and lightning talks — no prior experience needed.",
      status: "PUBLISHED",
      type: "SINGLE",
      visibility: "PUBLIC",
      category: "TECH",
      tags: ["hackathon", "students", "beginner-friendly"],
      startDate: inDays(14),
      endDate:   new Date(inDays(14).getTime() + 5 * 60 * 60 * 1000), // +5 hours
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
      createdById: organizer.id,
      publishedAt: new Date(),
      contactEmail: "tech@demo-university.edu",
      ticketTypes: {
        create: [
          { name: "General Admission", price: 0, currency: "INR", maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0 },
        ],
      },
    },
  })
  console.log(`  ✓ Free event: /events/${freeEvent.slug}`)

  const paidEvent = await prisma.event.upsert({
    where: { slug: "web-dev-workshop-2026" },
    update: {},
    create: {
      title: "Web Dev Workshop: Build a SaaS in a Day",
      slug: "web-dev-workshop-2026",
      description:
        "A hands-on one-day workshop where we build a production-ready SaaS from scratch. Covers Next.js, Prisma, auth, payments, and deploying to the cloud. Materials included.",
      shortDescription: "Hands-on workshop: build a production SaaS in one day.",
      status: "PUBLISHED",
      type: "SINGLE",
      visibility: "PUBLIC",
      category: "WORKSHOP",
      tags: ["nextjs", "workshop", "hands-on"],
      startDate: inDays(30),
      endDate:   new Date(inDays(30).getTime() + 8 * 60 * 60 * 1000),
      timezone: "Asia/Kolkata",
      venue: "Innovation Hub",
      venueAddress: "Demo University, Innovation Hub 2nd Floor",
      venueCity: "Bengaluru",
      venueState: "Karnataka",
      venueCountry: "India",
      isOnline: false,
      isPaid: true,
      maxCapacity: 50,
      organizationId: techClub.id,
      createdById: organizer.id,
      publishedAt: new Date(),
      contactEmail: "tech@demo-university.edu",
      ticketTypes: {
        create: [
          { name: "Early Bird",   price: 499,  currency: "INR", quantity: 25, sold: 0, maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 0, description: "First 25 seats — a steal." },
          { name: "Regular",      price: 799,  currency: "INR", quantity: 25, sold: 0, maxPerUser: 1, isActive: true, isHidden: false, sortOrder: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Paid event: /events/${paidEvent.slug}`)

  // ── Coupon (tied to the paid event) ─────────────────────────────────────
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
  console.log("  ✓ Coupon: WELCOME10 (10% off, valid 6 months, scoped to the paid event)")

  console.log("\n🎉 Demo seed complete.\n")
  console.log("── Credentials ──")
  console.log("  Attendee:  demo@eventflow.com         / Demo@123456")
  console.log("  Organizer: organizer@eventflow.com    / Organizer@123456")
  console.log("  Super:     admin@eventflow.com        / Admin@123456   (from base seed)")
  console.log("")
  console.log("── Routes to try ──")
  console.log(`  /events                           (both events should appear)`)
  console.log(`  /events/${freeEvent.slug}         (free flow)`)
  console.log(`  /events/${paidEvent.slug}         (paid flow — try coupon WELCOME10)`)
  console.log(`  /admin/org                        (log in as organizer)`)
}

main()
  .catch((e) => { console.error("Demo seed failed:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
