import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

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

  console.log("✅ Seeding complete!")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
