"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode"
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
  // containerId must be stable across renders but unique per mounted component
  // (multiple scanners on the same page would collide otherwise).
  const containerIdRef = useRef<string>(`qr-scanner-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    if (!enabled) {
      void stopScanner()
      return
    }
    void startScanner()
    return () => {
      void stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Html5Qrcode.stop() throws "Cannot stop, scanner is not running or paused"
  // when called on an instance that hasn't started yet. Guard with getState().
  const safeStop = async (scanner: Html5Qrcode) => {
    try {
      const state = scanner.getState()
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop()
      }
      // Clear rendered video element to free the camera.
      try { scanner.clear() } catch { /* no-op if already cleared */ }
    } catch {
      // Swallow — we're unmounting or reconfiguring, caller doesn't care.
    }
  }

  const startScanner = async () => {
    // Reuse the existing scanner if we already have one — stopping & recreating
    // is what produced the "cannot stop" error previously.
    if (scannerRef.current) {
      const state = scannerRef.current.getState()
      if (state === Html5QrcodeScannerState.SCANNING) return
      await safeStop(scannerRef.current)
    }

    // Html5Qrcode looks the element up by id, so the DOM node must exist by
    // now. Because useEffect fires after render, the container div with this
    // id is already in the tree.
    try {
      const scanner = new Html5Qrcode(containerIdRef.current)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          const now = Date.now()
          // Debounce: ignore the same QR within 3 seconds.
          if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 3000) return
          lastScanRef.current = decodedText
          lastScanTimeRef.current = now
          if (navigator.vibrate) navigator.vibrate(100)
          onScan(decodedText)
        },
        () => { /* scan failures are normal when no QR is in view */ }
      )

      setIsStarted(true)
      setHasPermission(true)
    } catch (err) {
      // The most common real cause is the user denying camera permission, or
      // the camera being held by another tab. Surface both cleanly.
      console.warn("QR scanner failed to start:", err)
      scannerRef.current = null
      setIsStarted(false)
      setHasPermission(false)
      onError?.(
        (err as { message?: string })?.message?.includes("Permission")
          ? "Camera permission was denied. Allow camera access and try again."
          : "Camera not available. It may be in use by another tab or app."
      )
    }
  }

  const stopScanner = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    await safeStop(scanner)
    scannerRef.current = null
    setIsStarted(false)
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CameraOff className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="font-medium">Camera Access Required</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Please allow camera access in your browser settings, then click Try Again.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => { setHasPermission(null); void startScanner() }}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        id={containerIdRef.current}
        className={cn(
          "w-full rounded-lg overflow-hidden bg-black",
          !isStarted && "min-h-64 flex items-center justify-center"
        )}
      >
        {!isStarted && (
          <div className="text-center text-white/60">
            <Camera className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Starting camera…</p>
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
