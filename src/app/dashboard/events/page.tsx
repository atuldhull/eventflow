"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Calendar, Loader2 } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/PageHeader"

export default function MyEventsPage() {
  const { data: session } = useSession()

  return (
    <div className="space-y-6">
      <PageHeader title="My Events" description="Events you've registered for" />

      <div className="text-center py-16">
        <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="font-medium">No events yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Events you register for will appear here.
        </p>
        <Link href="/events" className="text-sm text-primary hover:underline mt-3 inline-block">
          Browse Events
        </Link>
      </div>
    </div>
  )
}
