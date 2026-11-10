"use client"

import { useId, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// The upload route accepts exactly these image types (identified by their bytes) up to 5MB.
const ACCEPT = ["image/png", "image/jpeg", "image/webp"]
const MAX_BYTES = 5 * 1024 * 1024

/** Upload one image through POST /api/upload; resolves to its URL. */
async function uploadImage(file: File): Promise<string> {
  if (!ACCEPT.includes(file.type)) throw new Error("Use a PNG, JPG or WebP image")
  if (file.size > MAX_BYTES) throw new Error("Images can be up to 5MB")
  const body = new FormData()
  body.append("file", file)
  const res = await fetch("/api/upload", { method: "POST", body })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.message || "Upload failed")
  const url = json.data?.url as string | undefined
  if (!url || !/\.(png|jpe?g|webp)$/.test(url)) throw new Error("Use a PNG, JPG or WebP image")
  return url
}

/**
 * A drop zone (click, keyboard or drag-and-drop) for a logo or banner. The uploaded URL is
 * handed to `onChange`; the page saves it through its own API.
 */
export function ImageDropZone({
  label,
  hint,
  value,
  onChange,
  variant = "logo",
  disabled,
}: {
  label: string
  hint: string
  value: string | null
  onChange: (url: string | null) => void
  variant?: "logo" | "banner"
  disabled?: boolean
}) {
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return
    setError(null)
    setUploading(true)
    try {
      onChange(await uploadImage(file))
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed"
      setError(message)
      toast.error(message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={ACCEPT.join(",")}
      className="sr-only"
      aria-describedby={hintId}
      disabled={disabled || uploading}
      onChange={(e) => handleFile(e.target.files?.[0])}
    />
  )

  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium" id={`${inputId}-label`}>{label}</p>
      {value ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-raised",
              variant === "logo" ? "size-20" : "aspect-[24/5] w-full sm:w-72"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={`Current ${label.toLowerCase()}`} className={cn("size-full", variant === "logo" ? "object-contain" : "object-cover")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={() => onChange(null)}>
              Remove
            </Button>
            {input}
          </div>
          <p id={hintId} className="sr-only">{hint}</p>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-raised/50 px-4 text-center transition-colors hover:border-foreground/30 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/35",
            variant === "logo" ? "h-32" : "h-24",
            dragging && "border-foreground/40 bg-muted",
            (disabled || uploading) && "pointer-events-none opacity-70"
          )}
        >
          {uploading ? (
            <Loader2 className="mb-1 size-5 animate-spin text-faint" aria-hidden />
          ) : (
            <Upload className="mb-1 size-5 text-faint" aria-hidden />
          )}
          <span className="text-[13px] text-foreground">{uploading ? "Uploading…" : "Drag & drop or click to upload"}</span>
          <span id={hintId} className="text-xs text-muted-foreground">{hint}</span>
          {input}
        </label>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
