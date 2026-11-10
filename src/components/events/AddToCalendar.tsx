"use client"

import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { generateICSFile, getGoogleCalendarUrl } from "@/lib/calendar"

interface AddToCalendarProps {
  title: string
  description?: string
  startDate: string
  endDate: string
  venue?: string | null
  isOnline?: boolean
  onlinePlatform?: string | null
  slug?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "icon"
  className?: string
}

export function AddToCalendar({ title, description, startDate, endDate, venue, isOnline, onlinePlatform, slug, variant = "outline", size = "sm", className }: AddToCalendarProps) {
  const calEvent = {
    title,
    description,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    venue,
    isOnline,
    onlinePlatform,
    slug,
  }

  const handleGoogleCalendar = () => {
    const url = getGoogleCalendarUrl(calEvent)
    window.open(url, "_blank")
  }

  const handleOutlook = () => {
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: title,
      startdt: new Date(startDate).toISOString(),
      enddt: new Date(endDate).toISOString(),
      body: description || "",
      location: isOnline ? "Online" : (venue || ""),
    })
    window.open(`https://outlook.live.com/calendar/0/deeplink/compose?${params}`, "_blank")
  }

  const handleICS = () => {
    const ics = generateICSFile(calEvent)
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "-")}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={variant} size={size} className={cn("gap-2", className)} />}>
        <CalendarPlus className="size-4" aria-hidden /> Add to calendar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={handleGoogleCalendar}>Google Calendar</DropdownMenuItem>
        <DropdownMenuItem onClick={handleOutlook}>Outlook</DropdownMenuItem>
        <DropdownMenuItem onClick={handleICS}>Apple Calendar / ICS</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
