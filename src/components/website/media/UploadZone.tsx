"use client"

import { useRef } from "react"
import { Upload, Loader2, ImageUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatSize } from "./types"

/** What POST /api/upload accepts as an image (it checks the bytes, not this list). */
export const UPLOAD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const UPLOAD_IMAGE_MAX = 5 * 1024 * 1024

interface Props {
  show: boolean
  uploadFile: File | null
  setUploadFile: (f: File | null) => void
  uploadUrl: string
  uploadName: string
  uploadFolder: string
  folders: string[]
  isUploading: boolean
  setUploadUrl: (v: string) => void
  setUploadName: (v: string) => void
  setUploadFolder: (v: string) => void
  onUpload: () => void
  onCancel: () => void
}

export const nativeSelectClass =
  "h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11 dark:bg-input/30"

export function UploadZone({
  show, uploadFile, setUploadFile, uploadUrl, uploadName, uploadFolder, folders, isUploading,
  setUploadUrl, setUploadName, setUploadFolder, onUpload, onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  if (!show) return null
  const ready = !!uploadFile || !!uploadUrl.trim()

  const choose = (file: File | undefined) => {
    if (!file) return
    setUploadFile(file)
    if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, ""))
  }

  return (
    <Card className="gap-0 p-0">
      <form
        onSubmit={(e) => { e.preventDefault(); if (ready && !isUploading) onUpload() }}
        className="grid gap-4 p-4"
      >
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files?.[0]) }}
        >
          <ImageUp className="size-6 text-muted-foreground" aria-hidden />
          {uploadFile ? (
            <div className="flex max-w-full items-center gap-2 text-sm">
              <span className="truncate font-medium">{uploadFile.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{formatSize(uploadFile.size)}</span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove the chosen file" onClick={() => { setUploadFile(null); if (inputRef.current) inputRef.current.value = "" }}>
                <X />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Drop an image here, or choose one. JPG, PNG or WebP, up to 5 MB.</p>
          )}
          <input
            ref={inputRef}
            id="upload-file"
            type="file"
            accept={UPLOAD_IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {uploadFile ? "Choose another image" : "Choose image"}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="upload-url">Or add from a URL</Label>
            <Input
              id="upload-url"
              value={uploadUrl}
              onChange={(e) => setUploadUrl(e.target.value)}
              placeholder="https://..."
              inputMode="url"
              disabled={!!uploadFile}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="upload-name">File name</Label>
            <Input id="upload-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="File name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="upload-folder">Folder</Label>
            <select id="upload-folder" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} className={nativeSelectClass}>
              <option value="general">General</option>
              {folders.filter((f) => f !== "general").map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} className="max-sm:flex-1">Cancel</Button>
          <Button type="submit" disabled={!ready || isUploading} className="max-sm:flex-1">
            {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}{uploadFile ? "Upload image" : "Add image"}
          </Button>
        </div>
      </form>
    </Card>
  )
}
