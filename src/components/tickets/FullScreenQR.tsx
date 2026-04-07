"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { QRCodeDisplay } from "./QRCodeDisplay"

interface FullScreenQRProps {
  qrData: string
  ticketNumber: string
  eventTitle: string
  onClose: () => void
}

export function FullScreenQR({ qrData, ticketNumber, eventTitle, onClose }: FullScreenQRProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"

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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>

      <p className="text-white/60 text-sm mb-4">{eventTitle}</p>

      <QRCodeDisplay
        data={qrData}
        size={320}
        ticketNumber={ticketNumber}
        variant="fullscreen"
      />

      <p className="text-white/40 text-xs mt-6">Tap anywhere to close</p>
    </div>
  )
}
