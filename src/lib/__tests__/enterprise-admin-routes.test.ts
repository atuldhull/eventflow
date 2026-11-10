import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Enterprise-admin and super-admin routes run against the REAL authorize() with Prisma
// replaced by a small in-memory fixture.
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  enterpriseMember: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  organizationMember: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  eventTeamMember: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
  enterprise: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  payment: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const auditMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/tenant", () => ({ clearTenantCache: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: auditMock,
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))

import * as membersRoute from "@/app/api/admin/enterprise/[enterpriseId]/members/route"
import * as paymentsExport from "@/app/api/admin/enterprise/[enterpriseId]/payments/export/route"
import * as auditExport from "@/app/api/admin/enterprise/[enterpriseId]/audit-logs/export/route"
import * as enterpriseRoute from "@/app/api/admin/enterprise/[enterpriseId]/route"
import * as superEnterpriseRoute from "@/app/api/super-admin/enterprises/[id]/route"

const ENT = "ent_1"
const USERS: Record<string, string> = {
  super: "SUPER_ADMIN",
  owner: "ENTERPRISE_ADMIN",
  entAdmin: "ENTERPRISE_ADMIN",
  entManager: "USER",
  alice: "ORG_ADMIN", // an org admin with no enterprise membership
}
const MEMBERS: Record<string, string> = { owner: "ENTERPRISE_ADMIN", entAdmin: "ENTERPRISE_ADMIN", entManager: "ENTERPRISE_MANAGER" }
const ENTERPRISE = { id: ENT, name: "Temp Enterprise", slug: "temp-enterprise", ownerId: "owner", customDomain: null, isActive: true }

const url = (path: string) => `http://localhost:3000${path}`
const get = (path: string) => new NextRequest(url(path))
const del = (path: string, body: unknown) =>
  new NextRequest(url(path), { method: "DELETE", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const entCtx = { params: Promise.resolve({ enterpriseId: ENT }) }

function signIn(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId, role: USERS[userId], name: userId, email: `${userId}@test.local` } })
}

beforeEach(() => {
  vi.resetAllMocks()
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    USERS[where.id] ? { role: USERS[where.id], isActive: true } : null
  )
  prismaMock.enterpriseMember.findUnique.mockImplementation(
    async ({ where }: { where: { enterpriseId_userId: { enterpriseId: string; userId: string } } }) => {
      const { enterpriseId, userId } = where.enterpriseId_userId
      return enterpriseId === ENT && MEMBERS[userId] ? { role: MEMBERS[userId], isActive: true } : null
    }
  )
  prismaMock.enterprise.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === ENT ? ENTERPRISE : null))
  prismaMock.enterprise.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === ENT ? ENTERPRISE : null))
  prismaMock.enterprise.update.mockResolvedValue(ENTERPRISE)
  prismaMock.enterpriseMember.findMany.mockResolvedValue([])
  prismaMock.enterpriseMember.count.mockResolvedValue(0)
  prismaMock.payment.findMany.mockResolvedValue([])
  prismaMock.auditLog.findMany.mockResolvedValue([])
})

describe("enterprise lists and exports need the permission in THAT enterprise", () => {
  it("refuses an org admin who is not an enterprise member", async () => {
    signIn("alice")
    expect((await membersRoute.GET(get(`/api/admin/enterprise/${ENT}/members`), entCtx)).status).toBe(403)
    expect((await paymentsExport.GET(get(`/api/admin/enterprise/${ENT}/payments/export`), entCtx)).status).toBe(403)
    expect((await auditExport.GET(get(`/api/admin/enterprise/${ENT}/audit-logs/export`), entCtx)).status).toBe(403)
    expect(prismaMock.payment.findMany).not.toHaveBeenCalled()
  })

  it("refuses exports to an enterprise manager (no export permissions) but lists members", async () => {
    signIn("entManager")
    expect((await paymentsExport.GET(get(`/api/admin/enterprise/${ENT}/payments/export`), entCtx)).status).toBe(403)
    expect((await auditExport.GET(get(`/api/admin/enterprise/${ENT}/audit-logs/export`), entCtx)).status).toBe(403)
    expect((await membersRoute.GET(get(`/api/admin/enterprise/${ENT}/members`), entCtx)).status).toBe(200)
  })

  it("exports a scoped, formula-safe CSV for an enterprise admin and audits the export", async () => {
    signIn("entAdmin")
    prismaMock.payment.findMany.mockResolvedValue([
      {
        paymentNumber: "PAY-1", amount: 500, currency: "INR", status: "COMPLETED", method: "UPI", createdAt: new Date("2026-01-01T00:00:00Z"),
        user: { name: "=cmd|' /C calc'!A0", email: "x@y.z" },
        registration: { registrationNumber: "REG-1", event: { title: "Fest", organization: { name: "Club" } } },
      },
    ])
    const res = await paymentsExport.GET(get(`/api/admin/enterprise/${ENT}/payments/export?search=fest`), entCtx)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/csv")
    const body = await res.text()
    expect(body).toContain(`"'=cmd|' /C calc'!A0"`)
    const where = prismaMock.payment.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain(ENT)
    expect(JSON.stringify(where.OR)).toContain("fest")
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "EXPORT", enterpriseId: ENT }))
  })
})

describe("deleting an enterprise", () => {
  it("lets only the owner delete from enterprise settings", async () => {
    signIn("entAdmin")
    const res = await enterpriseRoute.DELETE(del(`/api/admin/enterprise/${ENT}`, { confirm: "Temp Enterprise" }), entCtx)
    expect(res.status).toBe(403)
    expect(prismaMock.enterprise.update).not.toHaveBeenCalled()
  })

  it("requires the typed name, then soft-deletes and audits", async () => {
    signIn("owner")
    expect((await enterpriseRoute.DELETE(del(`/api/admin/enterprise/${ENT}`, { confirm: "Temp" }), entCtx)).status).toBe(400)
    expect(prismaMock.enterprise.update).not.toHaveBeenCalled()

    const res = await enterpriseRoute.DELETE(del(`/api/admin/enterprise/${ENT}`, { confirm: "temp enterprise" }), entCtx)
    expect(res.status).toBe(200)
    const data = prismaMock.enterprise.update.mock.calls[0][0].data
    expect(data.deletedAt).toBeInstanceOf(Date)
    expect(data.isActive).toBe(false)
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "DELETE", entityType: "ENTERPRISE", entityId: ENT }))
  })

  it("super-admin delete is super-admin only and also checks the typed name", async () => {
    const ctx = { params: Promise.resolve({ id: ENT }) }
    signIn("owner")
    expect((await superEnterpriseRoute.DELETE(del(`/api/super-admin/enterprises/${ENT}`, { confirm: "Temp Enterprise" }), ctx)).status).toBe(403)

    signIn("super")
    expect((await superEnterpriseRoute.DELETE(del(`/api/super-admin/enterprises/${ENT}`, {}), ctx)).status).toBe(400)
    expect((await superEnterpriseRoute.DELETE(del(`/api/super-admin/enterprises/${ENT}`, { confirm: "nope" }), ctx)).status).toBe(400)
    expect(prismaMock.enterprise.update).not.toHaveBeenCalled()
    expect((await superEnterpriseRoute.DELETE(del(`/api/super-admin/enterprises/${ENT}`, { confirm: "temp-enterprise" }), ctx)).status).toBe(200)
    expect(prismaMock.enterprise.update).toHaveBeenCalledTimes(1)
  })
})
