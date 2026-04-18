import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { z } from "zod/v4"

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  category: z.string().optional(),
  description: z.string().max(500).optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  website: z.string().optional(),
})

const MAX_ORGS_PER_USER = 10

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, emailVerified: true, isActive: true, isBanned: true },
  })

  if (!user || !user.isActive || user.isBanned) {
    return NextResponse.json({ success: false, message: "Your account is not allowed to create organizations" }, { status: 403 })
  }

  if (!user.emailVerified) {
    return NextResponse.json({ success: false, message: "Please verify your email before creating an organization" }, { status: 403 })
  }

  // Anti-spam: cap how many orgs a single user can admin via self-service
  if (user.role !== "SUPER_ADMIN") {
    const ownedOrgCount = await prisma.organizationMember.count({
      where: { userId: session.user.id, role: "ORG_ADMIN", isActive: true },
    })
    if (ownedOrgCount >= MAX_ORGS_PER_USER) {
      return NextResponse.json(
        { success: false, message: `You have reached the limit of ${MAX_ORGS_PER_USER} organizations per account` },
        { status: 403 }
      )
    }
  }

  const body = await request.json()
  const parsed = createOrgSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  // Check slug uniqueness
  const existing = await prisma.organization.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) {
    return NextResponse.json({ success: false, message: "An organization with this slug already exists" }, { status: 409 })
  }

  // Create org and add user as ORG_ADMIN
  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      members: {
        create: {
          userId: session.user.id,
          role: "ORG_ADMIN",
          isActive: true,
        },
      },
    },
  })

  // Upgrade user role to ORG_ADMIN if they're just a USER (needed to access /admin shell)
  if (user.role === "USER") {
    await prisma.user.update({ where: { id: session.user.id }, data: { role: "ORG_ADMIN" } })
  }

  return NextResponse.json({ success: true, data: { id: org.id, slug: org.slug, name: org.name } }, { status: 201 })
}
