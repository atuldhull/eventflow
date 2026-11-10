"use client"

import { useEffect, useId, useRef, useState } from "react"
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
  // Bumped by "Try again": the effect below then starts the scanner after the render, when
  // the container element is in the DOM (calling start from the click handler ran before
  // React had mounted it, so Html5Qrcode found no element and retry never worked).
  const [attempt, setAttempt] = useState(0)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef<string>("")
  const lastScanTimeRef = useRef<number>(0)
  // containerId must be stable across renders but unique per mounted component
  // (multiple scanners on the same page would collide otherwise). useId gives the
  // same id on the server and the client; a random id hydrated with the server's
  // value, so Html5Qrcode looked up the client's id and found no element.
  const containerId = `qr-scanner-${useId()}`

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
  }, [enabled, attempt])

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
      const scanner = new Html5Qrcode(containerId)
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

  // The viewport is dark in both themes: navy-black ink in light mode, the frame black in dark mode.
  const viewport = "bg-foreground text-background dark:bg-frame dark:text-foreground"

  const denied = hasPermission === false

  return (
    <div>
      <div className={cn("relative w-full overflow-hidden rounded-2xl", viewport)}>
        {/* html5-qrcode owns this element's children; React draws its overlay beside it.
            It stays mounted in every state so a retry always finds it. */}
        <div id={containerId} className={cn("w-full", !isStarted && "aspect-square max-h-[440px] sm:aspect-video sm:max-h-[380px]")} />
        {denied ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <ViewfinderCorners />
            <CameraOff className="size-8 opacity-80" aria-hidden />
            <p className="mt-3 font-display text-xl font-bold tracking-[-0.02em]" role="alert">Camera access required</p>
            <p className="mt-1 max-w-xs text-[13px] opacity-70">
              Please allow camera access in your browser settings, then click Try again.
            </p>
            <Button
              variant="outline"
              className="relative mt-4 h-11 px-5 border-current/30 bg-transparent text-inherit hover:bg-current/10 dark:bg-transparent dark:hover:bg-current/10"
              onClick={() => { setHasPermission(null); setAttempt((n) => n + 1) }}
            >
              Try again
            </Button>
          </div>
        ) : !isStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <ViewfinderCorners />
            <Camera className="size-8 opacity-80" aria-hidden />
            <p className="mt-2 text-[15px] font-medium opacity-80" aria-live="polite">{enabled ? "Starting camera…" : "Scanner paused"}</p>
          </div>
        )}
      </div>
      {isStarted && (
        <p className="mt-2.5 text-center text-sm text-muted-foreground">
          Point camera at the QR code on the participant&apos;s ticket
        </p>
      )}
    </div>
  )
}

/** Four corner marks that frame where the code should go. Decorative. */
function ViewfinderCorners() {
  const corner = "absolute size-10 border-lemon"
  return (
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 aspect-square h-[62%] -translate-x-1/2 -translate-y-1/2">
      <span className={cn(corner, "top-0 left-0 rounded-tl-sm border-t-4 border-l-4")} />
      <span className={cn(corner, "top-0 right-0 rounded-tr-sm border-t-4 border-r-4")} />
      <span className={cn(corner, "bottom-0 left-0 rounded-bl-sm border-b-4 border-l-4")} />
      <span className={cn(corner, "right-0 bottom-0 rounded-br-sm border-r-4 border-b-4")} />
    </div>
  )
}
