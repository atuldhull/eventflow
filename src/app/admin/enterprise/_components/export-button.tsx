"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/**
 * Downloads a CSV from an export route with the page's current filters. Gate it with
 * <PermissionGate>; the route checks the export permission again.
 */
export function ExportButton({ url, fallbackName, label = "Export" }: { url: string; fallbackName: string; label?: string }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.message || "Export failed")
        return
      }
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
      toast.success("Export downloaded")
    } catch {
      toast.error("Export failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" onClick={download} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  )
}
