"use client"

import { useState, useEffect } from "react"
import { Upload, ImageIcon, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DataTableSearch } from "@/components/tables/DataTableToolbar"
import { cn } from "@/lib/utils"
import { useRBAC } from "@/hooks/useRBAC"

interface MediaItem {
  id: string; fileName: string; fileUrl: string; fileType: string
  fileSize: number; altText: string | null; folder: string; width: number | null; height: number | null
}

interface MediaPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (media: MediaItem) => void
  folder?: string
}

export function MediaPicker({ isOpen, onClose, onSelect, folder }: MediaPickerProps) {
  const { currentOrganizationId } = useRBAC()
  const [media, setMedia] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFolder, setActiveFolder] = useState(folder || "all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library")

  // Upload state
  const [uploadUrl, setUploadUrl] = useState("")
  const [uploadName, setUploadName] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (!isOpen || !currentOrganizationId) return
    fetchMedia()
  }, [isOpen, currentOrganizationId, activeFolder])

  async function fetchMedia() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (activeFolder && activeFolder !== "all") params.set("folder", activeFolder)
      if (searchQuery) params.set("search", searchQuery)
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media?${params}`)
      const json = await res.json()
      if (json.success) { setMedia(json.media); setFolders(json.folders || []) }
    } catch {} finally { setIsLoading(false) }
  }

  const handleSearch = () => fetchMedia()

  const handleUpload = async () => {
    if (!uploadUrl || !currentOrganizationId) return
    setIsUploading(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: uploadName || "uploaded-image", fileUrl: uploadUrl, fileType: "image/jpeg", folder: activeFolder !== "all" ? activeFolder : "general" }),
      })
      const json = await res.json()
      if (json.success) {
        setActiveTab("library")
        setUploadUrl(""); setUploadName("")
        fetchMedia()
        onSelect(json.data)
        onClose()
      }
    } catch {} finally { setIsUploading(false) }
  }

  const handleSelect = () => {
    const item = media.find((m) => m.id === selectedId)
    if (item) { onSelect(item); onClose() }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="px-5 pt-4 pb-0">
          <DialogTitle>Select image</DialogTitle>
          <DialogDescription className="sr-only">Pick an image from your media library or add one by URL.</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex shrink-0 gap-4 border-b px-5" role="tablist">
          {(["library", "upload"] as const).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
              className={cn("relative min-h-11 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5", activeTab === tab ? "text-foreground after:bg-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab === "library" ? "Library" : "Add by URL"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "library" && (
            <div className="space-y-3">
              <DataTableSearch value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Search images" className="sm:w-full" />

              {/* Folders */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Folder">
                <button type="button" onClick={() => setActiveFolder("all")} aria-pressed={activeFolder === "all"} className={cn("inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors pointer-coarse:h-9", activeFolder === "all" ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")}>All</button>
                {folders.map((f) => (
                  <button key={f} type="button" onClick={() => setActiveFolder(f)} aria-pressed={activeFolder === f} className={cn("inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors pointer-coarse:h-9", activeFolder === f ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")}>{f}</button>
                ))}
              </div>

              {isLoading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
                </div>
              ) : media.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No images found. Upload your first image!</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.filter((m) => m.fileType.startsWith("image")).map((item) => (
                    <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} onDoubleClick={() => { onSelect(item); onClose() }}
                      aria-pressed={selectedId === item.id}
                      aria-label={item.altText || item.fileName}
                      className={cn("relative aspect-square overflow-hidden rounded-md bg-raised ring-1 transition-shadow", selectedId === item.id ? "ring-2 ring-brand" : "ring-border hover:ring-input")}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- tenant media at arbitrary URLs */}
                      {item.fileUrl ? <img src={item.fileUrl} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><ImageIcon className="size-6 text-faint" /></div>}
                      {selectedId === item.id && <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-[4px] bg-brand text-brand-foreground"><Check className="size-3.5" /></span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <form onSubmit={(e) => { e.preventDefault(); if (uploadUrl && !isUploading) handleUpload() }} className="mx-auto grid max-w-md gap-4 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="picker-url">Image URL</Label>
                <Input id="picker-url" value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="https://..." inputMode="url" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="picker-name">File name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="picker-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="File name" />
              </div>
              <Button type="submit" variant="outline" disabled={!uploadUrl || isUploading} className="justify-self-start">
                {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}Add image
              </Button>
            </form>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-rule px-5 py-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSelect} disabled={!selectedId}>Select</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
