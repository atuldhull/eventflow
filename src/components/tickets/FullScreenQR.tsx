"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { QRCodeDisplay } from "./QRCodeDisplay"

interface FullScreenQRProps {
  qrData: string
  ticketNumber: string
  eventTitle: string
  onClose: () => void
}

/**
 * The door view: a full white screen (dark code on white scans best at
 * maximum brightness), the screen kept awake, the ticket number large for a
 * manual lookup. Tap anywhere or press Escape to close.
 */
export function FullScreenQR({ qrData, ticketNumber, eventTitle, onClose }: FullScreenQRProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    // Try to keep screen awake
    let wakeLock: WakeLockSentinel | null = null
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((wl) => { wakeLock = wl }).catch(() => {})
    }
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
      wakeLock?.release()
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ticket QR code for ${eventTitle}`}
      className="pt-safe pb-safe fixed inset-0 z-[100] flex animate-sheet-in flex-col items-center justify-center bg-white px-6 text-[#141b2d]"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Close QR code"
        className="absolute top-[max(env(safe-area-inset-top),1rem)] right-4 flex size-11 items-center justify-center rounded-full text-[#565c6b] hover:bg-[#eceff3]"
      >
        <X className="size-6" />
      </button>
      <p className="mb-6 max-w-[32ch] text-center text-[17px] leading-snug font-semibold">{eventTitle}</p>
      <QRCodeDisplay data={qrData} size={300} showTicketNumber={false} variant="print" />
      <p className="mt-4 font-mono text-2xl font-medium tracking-[0.08em]">{ticketNumber}</p>
      <p className="mt-8 text-sm text-[#565c6b]">Tap anywhere to close</p>
    </div>
  )
}
