import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { csvResponse, exportDateStamp, toCsv, type CsvValue } from "@/lib/csv-export"

/**
 * Registration answers are stored in Registration.formResponses as { name, phone?,
 * organization?, department?, <custom question label>: answer } (see the register page).
 * These keys are the built-in ones; everything else is a custom question.
 */
const BUILT_IN_ANSWERS = ["name", "email", "phone", "organization", "department"]
/** A cap on custom-question columns, so a malformed answer set can't explode the file. */
const MAX_CUSTOM_COLUMNS = 100

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** One answer as a cell: lists joined, yes/no for checkboxes, anything else as text. */
function answerCell(value: unknown): CsvValue {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return Number.isFinite(value) ? value : ""
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v))).join("; ")
  return JSON.stringify(value)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_EXPORT, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  // Optional: one event's registrations (still scoped to this organization).
  const eventId = request.nextUrl.searchParams.get("eventId")?.slice(0, 64) || undefined
  const eventScope = { organizationId: orgId, deletedAt: null, ...(eventId ? { id: eventId } : {}) }

  const [registrations, questions, org] = await Promise.all([
    prisma.registration.findMany({
      where: { event: { organizationId: orgId, deletedAt: null }, ...(eventId ? { eventId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50_000,
      select: {
        registrationNumber: true, status: true, createdAt: true, source: true, formResponses: true,
        user: { select: { name: true, email: true, phone: true } },
        event: { select: { title: true } },
        ticketType: { select: { name: true } },
        payment: { select: { amount: true } },
      },
    }),
    // The custom questions of the exported events, in form order: their columns come first.
    prisma.customFormField.findMany({
      where: { event: eventScope },
      orderBy: [{ eventId: "asc" }, { sortOrder: "asc" }],
      select: { label: true },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { enterpriseId: true } }),
  ])

  // Custom-question columns: the events' current questions, then any other answered key
  // (a question since renamed or removed), each label once.
  const customColumns: string[] = []
  const seen = new Set<string>()
  const addColumn = (label: string) => {
    const key = label.trim()
    if (!key || seen.has(key) || BUILT_IN_ANSWERS.includes(key.toLowerCase()) || customColumns.length >= MAX_CUSTOM_COLUMNS) return
    seen.add(key)
    customColumns.push(key)
  }
  for (const q of questions) addColumn(q.label)
  for (const r of registrations) {
    if (isRecord(r.formResponses)) for (const key of Object.keys(r.formResponses)) addColumn(key)
  }

  const headers = [
    "Registration #", "Participant Name", "Email", "Phone", "Organization", "Department",
    "Event", "Ticket Type", "Amount", "Status", "Source", "Registered On",
    ...customColumns,
  ]
  const rows: CsvValue[][] = registrations.map((r) => {
    const answers = isRecord(r.formResponses) ? r.formResponses : {}
    const text = (key: string) => (typeof answers[key] === "string" ? (answers[key] as string) : "")
    return [
      r.registrationNumber,
      r.user.name || text("name"),
      r.user.email,
      // the number given on the form for this event, else the profile's
      text("phone") || r.user.phone || "",
      text("organization"),
      text("department"),
      r.event.title,
      r.ticketType?.name || "General",
      r.payment ? Number(r.payment.amount) : 0,
      r.status,
      r.source || "WEBSITE",
      r.createdAt.toISOString().split("T")[0],
      // Every cell, answers included, goes through csvCell: formula-looking text is defused.
      ...customColumns.map((label) => answerCell(answers[label])),
    ]
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "EXPORT",
    entityType: "REGISTRATION",
    entityId: eventId ?? orgId,
    description: `Exported ${registrations.length} registrations${eventId ? " of one event" : ""}`,
    newValues: { eventId: eventId ?? null, rows: registrations.length, customColumns: customColumns.length },
    ipAddress,
    userAgent,
    ...(eventId ? { eventId } : {}),
    organizationId: orgId,
    enterpriseId: org?.enterpriseId ?? undefined,
  })

  return csvResponse(`registrations-${exportDateStamp()}.csv`, toCsv(headers, rows))
}
