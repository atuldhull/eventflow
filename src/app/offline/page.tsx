"use client"

import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <WifiOff className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold">You're Offline</h1>
        <p className="text-muted-foreground">
          No internet connection. Your tickets are cached and available — go to My Tickets to view them.
        </p>
        <div className="flex flex-col gap-2">
          <a href="/dashboard/tickets" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            View My Tickets
          </a>
          <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}
