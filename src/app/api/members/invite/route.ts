import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize, isEnterpriseOwner } from "@/lib/authorization"
import { canManageEnterpriseRole, canManageRole, PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/escape-html"
import { addPendingInvite, removePendingInvite } from "@/lib/org-invites"
import { addEnterprisePendingInvite, removeEnterprisePendingInvite } from "@/lib/enterprise-invites"
import type { Role } from "@/lib/constants"
import { z } from "zod/v4"

/** Most addresses one bulk invite may carry (InviteMemberDialog says the same). */
const MAX_BULK_INVITES = 50

const emailSchema = z.email("Invalid email address").transform((e) => e.trim().toLowerCase())

const inviteSchema = z
  .object({
    /** one address (the single-invite form) */
    email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), emailSchema).optional(),
    /** several addresses at once (bulk invite); each is checked like `email` */
    emails: z.array(z.preprocess((v) => (typeof v === "string" ? v.trim() : v), emailSchema)).min(1).max(MAX_BULK_INVITES).optional(),
    role: z.enum(["ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER"] as const),
    entityType: z.enum(["ENTERPRISE", "ORGANIZATION"] as const),
    entityId: z.string().min(1),
    message: z.string().trim().max(1000).optional(),
  })
  .refine((d) => !!d.email !== !!d.emails, { message: "Send either one email or a list of emails", path: ["email"] })

type InviteOutcome = "added" | "readded" | "invited" | "already_member"

/**
 * Invite people to an enterprise or organization. Someone with an account is added
 * straight away; anyone else gets a pending invitation (kept in the entity's settings)
 * that becomes a membership when they sign up and verify that address. Sending again to
 * a pending address refreshes it and re-sends the email (that is the "Resend" action).
 *
 * `emails` invites several addresses with the same role and message and answers with a
 * per-address result; a single `email` keeps the original responses (201, or 409 when
 * the person is already a member).
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = inviteSchema.safeParse(body)

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const which = issue?.path[0] === "emails" && typeof issue.path[1] === "number" ? ` (address ${issue.path[1] + 1})` : ""
      return NextResponse.json(
        { success: false, message: issue ? `${issue.message}${which}` : "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { role, entityType, entityId, message } = parsed.data
    const isBulk = !!parsed.data.emails
    const emails = Array.from(new Set(parsed.data.emails ?? [parsed.data.email!]))

    // Check permission
    const context = entityType === "ENTERPRISE"
      ? { enterpriseId: entityId }
      : { organizationId: entityId }

    const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_INVITE, context)
    if (!authResult.authorized || !authResult.role) {
      return NextResponse.json(
        { success: false, message: authResult.message || "You don't have permission to perform this action." },
        { status: 403 }
      )
    }

    // Role hierarchy against the caller's role in THIS entity, not their global role. In an
    // enterprise its owner may also add co-admins (ENTERPRISE_ADMIN).
    const callerIsOwner = entityType === "ENTERPRISE" && (await isEnterpriseOwner(entityId, session.user.id))
    const allowed = entityType === "ENTERPRISE"
      ? canManageEnterpriseRole(authResult.role, role as Role, callerIsOwner)
      : canManageRole(authResult.role, role as Role)
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message: role === "ENTERPRISE_ADMIN" && entityType === "ENTERPRISE"
            ? "Only the enterprise owner can add another enterprise admin."
            : "You cannot assign a role equal to or above your own.",
        },
        { status: 403 }
      )
    }

    // Get entity name for email (and make sure the entity exists and is live)
    let entityName = ""
    if (entityType === "ENTERPRISE") {
      const ent = await prisma.enterprise.findUnique({ where: { id: entityId }, select: { name: true } })
      if (!ent) return NextResponse.json({ success: false, message: "Enterprise not found." }, { status: 404 })
      entityName = ent.name
    } else {
      const org = await prisma.organization.findUnique({ where: { id: entityId }, select: { name: true } })
      if (!org) return NextResponse.json({ success: false, message: "Organization not found." }, { status: 404 })
      entityName = org.name
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    const inviterName = session.user.name || "A team member"
    const results: { email: string; outcome: InviteOutcome }[] = []

    for (const email of emails) {
      // Membership lookups are scoped to this entity. A removed (inactive) membership is
      // brought back rather than duplicated: (entity, user) is unique.
      const existing = entityType === "ENTERPRISE"
        ? await prisma.enterpriseMember.findFirst({
            where: { enterpriseId: entityId, user: { email } },
            select: { id: true, isActive: true },
          })
        : await prisma.organizationMember.findFirst({
            where: { organizationId: entityId, user: { email } },
            select: { id: true, isActive: true },
          })
      if (existing?.isActive) {
        results.push({ email, outcome: "already_member" })
        continue
      }

      // Check if user exists, if so add directly
      const targetUser = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })

      if (targetUser) {
        const membership = { role: role as Role, invitedBy: session.user.id, isActive: true, joinedAt: new Date() }
        if (entityType === "ENTERPRISE") {
          if (existing) {
            await prisma.enterpriseMember.update({ where: { id: existing.id }, data: membership })
          } else {
            await prisma.enterpriseMember.create({ data: { enterpriseId: entityId, userId: targetUser.id, ...membership } })
          }
          await removeEnterprisePendingInvite(entityId, email)
        } else {
          if (existing) {
            await prisma.organizationMember.update({ where: { id: existing.id }, data: membership })
          } else {
            await prisma.organizationMember.create({ data: { organizationId: entityId, userId: targetUser.id, ...membership } })
          }
          await removePendingInvite(entityId, email)
        }
      } else {
        // No account yet: keep the invitation so the team can see, resend or cancel it.
        const invite = {
          email,
          role,
          invitedAt: new Date().toISOString(),
          invitedById: session.user.id,
          invitedByName: session.user.name ?? undefined,
        }
        if (entityType === "ENTERPRISE") await addEnterprisePendingInvite(entityId, invite)
        else await addPendingInvite(entityId, invite)
      }

      // Send invite email. Everything placed in the HTML is escaped: the entity name, the
      // inviter's name and the message are all user-supplied.
      await sendEmail({
        to: email,
        subject: `You've been invited to join ${entityName} on EventFlow`,
        html: `
          <h2>You've been invited!</h2>
          <p>${escapeHtml(inviterName)} has invited you to join <strong>${escapeHtml(entityName)}</strong> as <strong>${escapeHtml(role.replace(/_/g, " "))}</strong>.</p>
          ${message ? `<p>Message: "${escapeHtml(message)}"</p>` : ""}
          <p>${targetUser ? "You have been added automatically." : "Create an EventFlow account with this email address. You'll join automatically once the address is verified."}</p>
        `,
      })

      await createAuditLog({
        userId: session.user.id,
        action: "CREATE",
        entityType: entityType === "ENTERPRISE" ? "ENTERPRISE" : "ORGANIZATION",
        entityId,
        description: targetUser
          ? `${existing ? "Re-added" : "Added"} ${email} as ${role}`
          : `Invited ${email} as ${role}`,
        newValues: { email, role },
        ipAddress,
        userAgent,
        ...(entityType === "ENTERPRISE" ? { enterpriseId: entityId } : { organizationId: entityId }),
      })

      results.push({ email, outcome: targetUser ? (existing ? "readded" : "added") : "invited" })
    }

    if (!isBulk) {
      const [only] = results
      if (only.outcome === "already_member") {
        return NextResponse.json({ success: false, message: "This user is already a member." }, { status: 409 })
      }
      return NextResponse.json(
        { success: true, message: only.outcome === "invited" ? "Invitation sent." : "Member added successfully." },
        { status: 201 }
      )
    }

    const count = (o: InviteOutcome[]) => results.filter((r) => o.includes(r.outcome)).length
    const added = count(["added", "readded"])
    const invited = count(["invited"])
    const already = count(["already_member"])
    const parts = [
      added && `${added} added`,
      invited && `${invited} invited`,
      already && `${already} already ${already === 1 ? "a member" : "members"}`,
    ].filter(Boolean)
    return NextResponse.json(
      {
        success: added + invited > 0,
        message: parts.join(", ") || "Nobody was invited.",
        data: { results, added, invited, alreadyMembers: already },
      },
      { status: added + invited > 0 ? 201 : 409 }
    )
  } catch (error) {
    console.error("Invite error:", error)
    return NextResponse.json({ success: false, message: "Something went wrong." }, { status: 500 })
  }
}
