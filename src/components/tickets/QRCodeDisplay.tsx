"use client"

import { QRCodeSVG } from "qrcode.react"
import { cn } from "@/lib/utils"

interface QRCodeDisplayProps {
  data: string
  size?: number
  showTicketNumber?: boolean
  ticketNumber?: string
  variant?: "default" | "fullscreen" | "print"
}

export function QRCodeDisplay({
  data,
  size = 200,
  showTicketNumber = true,
  ticketNumber,
  variant = "default",
}: QRCodeDisplayProps) {
  if (variant === "fullscreen") {
    return (
      <div className="flex flex-col items-center gap-4">
        <QRCodeSVG
          value={data}
          size={Math.min(size, 400)}
          level="M"
          includeMargin
          bgColor="#ffffff"
          fgColor="#000000"
        />
        {showTicketNumber && ticketNumber && (
          <p className="text-xl font-mono font-bold tracking-wider text-white">{ticketNumber}</p>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      "inline-flex flex-col items-center gap-2 rounded-lg",
      variant !== "print" && "p-4",
      variant === "default" && "border bg-white"
    )}>
      <QRCodeSVG
        value={data}
        size={size}
        level="M"
        includeMargin
        bgColor="#ffffff"
        fgColor="#000000"
      />
      {showTicketNumber && ticketNumber && (
        <p className="font-mono text-sm font-medium tracking-[0.08em] text-[#141b2d]">{ticketNumber}</p>
      )}
    </div>
  )
}
