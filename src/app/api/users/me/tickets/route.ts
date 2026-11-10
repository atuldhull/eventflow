import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { TICKET_STATUSES, TICKET_TIMEFRAMES, getUserTickets } from "@/lib/ticket"

// Both filters are optional; without them every ticket of the user comes back (the
// tickets page groups them into upcoming / happening now / past itself).
const querySchema = z.object({
  status: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : v), z.enum(TICKET_STATUSES)).optional(),
  timeframe: z.enum(TICKET_TIMEFRAMES).optional(),
})

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const status = sp.get("status")
  const parsed = querySchema.safeParse({
    status: status && status.toLowerCase() !== "all" ? status : undefined,
    timeframe: sp.get("timeframe") || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid filter" }, { status: 400 })
  }

  const tickets = await getUserTickets(session.user.id, parsed.data.status, parsed.data.timeframe)

  return NextResponse.json({
    success: true,
    data: tickets.map((t) => ({
      ...t,
      event: {
        ...t.event,
        startDate: t.event.startDate.toISOString(),
        endDate: t.event.endDate.toISOString(),
      },
      ticketType: { ...t.ticketType, price: Number(t.ticketType.price) },
    })),
  })
}
