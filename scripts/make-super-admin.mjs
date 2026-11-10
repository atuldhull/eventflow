// Makes an existing account a platform admin (super admin). For a new server, where the
// demo seed must not run: sign up on the site first, then
//   docker compose run --rm migrate node scripts/make-super-admin.mjs you@yourdomain.in
// (locally: node scripts/make-super-admin.mjs you@yourdomain.in)
import { PrismaClient } from "@prisma/client"

const email = (process.argv[2] || "").trim().toLowerCase()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/make-super-admin.mjs <email of an account that already signed up>")
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, deletedAt: null } })
  if (!user) {
    console.error(`No account with ${email}. Sign up on the site first, then run this again.`)
    process.exitCode = 1
  } else if (user.role === "SUPER_ADMIN") {
    console.log(`${email} is already a platform admin.`)
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: "SUPER_ADMIN", isActive: true } })
    await prisma.auditLog.create({
      data: { userId: user.id, action: "UPDATE", entityType: "USER", entityId: user.id, description: "Made platform admin from the server command line" },
    })
    console.log(`${email} is now a platform admin. Sign out and in again to see /super-admin.`)
  }
} finally {
  await prisma.$disconnect()
}
