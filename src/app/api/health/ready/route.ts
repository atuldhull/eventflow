import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse("OK", { status: 200 })
  } catch {
    return new NextResponse("Service Unavailable", { status: 503 })
  }
}
