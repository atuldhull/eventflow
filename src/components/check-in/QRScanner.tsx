"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Camera, CameraOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: string) => void
  enabled: boolean
}

export function QRScanner({ onScan, onError, enabled }: QRScannerProps) {
  const [isStarted, setIsStarted] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef<string>("")
  const lastScanTimeRef = useRef<number>(0)
  const containerRef = useRef<string>(`qr-scanner-${Date.now()}`)

  useEffect(() => {
    if (!enabled) {
      stopScanner()
      return
    }

    startScanner()

    return () => {
      stopScanner()
    }
  }, [enabled])

  const startScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {})
      }

      const scanner = new Html5Qrcode(containerRef.current)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const now = Date.now()
          // Debounce: don't re-scan same code within 3 seconds
          if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 3000) {
            return
          }
          lastScanRef.current = decodedText
          lastScanTimeRef.current = now

          // Haptic feedback
          if (navigator.vibrate) navigator.vibrate(100)

          onScan(decodedText)
        },
        () => {} // Ignore scan failures (normal when no QR in view)
      )

      setIsStarted(true)
      setHasPermission(true)
    } catch (err) {
      console.error("Scanner start error:", err)
      setHasPermission(false)
      onError?.("Camera permission denied or not available")
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current && isStarted) {
      try {
        await scannerRef.current.stop()
      } catch {}
      setIsStarted(false)
    }
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CameraOff className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="font-medium">Camera Access Required</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Please allow camera access in your browser settings to scan QR codes.
        </p>
        <Button variant="outline" className="mt-4" onClick={startScanner}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        id={containerRef.current}
        className={cn(
          "w-full rounded-lg overflow-hidden bg-black",
          !isStarted && "min-h-64 flex items-center justify-center"
        )}
      >
        {!isStarted && (
          <div className="text-center text-white/60">
            <Camera className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}
      </div>
      {isStarted && (
        <p className="text-center text-xs text-muted-foreground mt-2">
          Point camera at the QR code on the participant&apos;s ticket
        </p>
      )}
    </div>
  )
}
