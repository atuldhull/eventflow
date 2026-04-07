import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getUserTickets } from "@/lib/ticket"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get("status") || undefined
  const timeframe = searchParams.get("timeframe") || undefined

  const tickets = await getUserTickets(session.user.id, status, timeframe)

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
