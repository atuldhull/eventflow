"use client"

import { useState, useEffect } from "react"
import { Upload, Search, Grid3X3, List, FolderPlus, Trash2, ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { type MediaItem, formatSize } from "@/components/website/media/types"
import { UploadZone } from "@/components/website/media/UploadZone"
import { MediaCard } from "@/components/website/media/MediaCard"
import { MediaListRow } from "@/components/website/media/MediaListRow"
import { MediaDetailDrawer } from "@/components/website/media/MediaDetailDrawer"

export default function MediaLibraryPage() {
  const { currentOrganizationId } = useRBAC()
  const [media, setMedia] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFolder, setActiveFolder] = useState("all")
  const [fileTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  // Upload state
  const [uploadUrl, setUploadUrl] = useState("")
  const [uploadName, setUploadName] = useState("")
  const [uploadFolder, setUploadFolder] = useState("general")
  const [isUploading, setIsUploading] = useState(false)

  // Detail edit state
  const [editAlt, setEditAlt] = useState("")
  const [editFolder, setEditFolder] = useState("")
  const [editTags, setEditTags] = useState("")
  const [isSavingDetail, setIsSavingDetail] = useState(false)

  useEffect(() => {
    if (!currentOrganizationId) return
    fetchMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId, activeFolder, sortBy])

  async function fetchMedia() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ sort: sortBy, limit: "100" })
      if (activeFolder !== "all") params.set("folder", activeFolder)
      if (searchQuery) params.set("search", searchQuery)
      if (fileTypeFilter !== "all") params.set("fileType", fileTypeFilter)
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media?${params}`)
      const json = await res.json()
      if (json.success) {
        setMedia(json.media)
        setFolders(json.folders || [])
        setTotalSize(json.totalSize || 0)
      }
    } catch {} finally { setIsLoading(false) }
  }

  const handleUpload = async () => {
    if (!uploadUrl || !currentOrganizationId) return
    setIsUploading(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: uploadName || "image", fileUrl: uploadUrl, fileType: "image/jpeg", folder: uploadFolder }),
      })
      const json = await res.json()
      if (json.success) { toast.success("File added!"); setUploadUrl(""); setUploadName(""); setShowUpload(false); fetchMedia() }
      else toast.error(json.message)
    } catch { toast.error("Upload failed") } finally { setIsUploading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!currentOrganizationId) return
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Deleted"); fetchMedia(); if (detailItem?.id === id) setDetailItem(null) }
      else toast.error(json.message)
    } catch { toast.error("Failed") }
  }

  const handleBulkDelete = async () => {
    if (!currentOrganizationId || selected.size === 0) return
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", mediaIds: Array.from(selected) }),
      })
      const json = await res.json()
      if (json.success) { toast.success(`${json.successCount} files deleted`); setSelected(new Set()); fetchMedia() }
    } catch { toast.error("Failed") }
  }

  const handleSaveDetail = async () => {
    if (!currentOrganizationId || !detailItem) return
    setIsSavingDetail(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media/${detailItem.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: editAlt, folder: editFolder, tags: editTags.split(",").map((t) => t.trim()).filter(Boolean) }),
      })
      const json = await res.json()
      if (json.success) { toast.success("Saved"); fetchMedia() }
    } catch { toast.error("Failed") } finally { setIsSavingDetail(false) }
  }

  const openDetail = (item: MediaItem) => {
    setDetailItem(item)
    setEditAlt(item.altText || "")
    setEditFolder(item.folder)
    setEditTags(item.tags.join(", "))
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  if (isLoading && media.length === 0) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-muted-foreground">{media.length} files &bull; {formatSize(totalSize)} used</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewFolder(true)} className="gap-1"><FolderPlus className="h-3.5 w-3.5" />Folder</Button>
          <Button size="sm" onClick={() => setShowUpload(!showUpload)} className="gap-1"><Upload className="h-3.5 w-3.5" />Upload</Button>
        </div>
      </div>

      <UploadZone
        show={showUpload}
        uploadUrl={uploadUrl}
        uploadName={uploadName}
        uploadFolder={uploadFolder}
        folders={folders}
        isUploading={isUploading}
        setUploadUrl={setUploadUrl}
        setUploadName={setUploadName}
        setUploadFolder={setUploadFolder}
        onUpload={handleUpload}
        onCancel={() => setShowUpload(false)}
      />

      {/* New folder dialog */}
      {showNewFolder && (
        <Card className="p-3 flex items-center gap-2">
          <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="folder-name" className="text-sm h-8 w-40" />
          <Button size="sm" className="h-8" onClick={() => { if (newFolderName) { setFolders([...folders, newFolderName]); setNewFolderName(""); setShowNewFolder(false); toast.success("Folder created") } }}>Create</Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowNewFolder(false)}>Cancel</Button>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchMedia()} placeholder="Search files..." className="pl-8 h-9 text-sm" />
        </div>
        <select value={activeFolder} onChange={(e) => setActiveFolder(e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-xs">
          <option value="all">All Folders</option>
          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-xs">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="largest">Largest</option>
        </select>
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md ${viewMode === "grid" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Grid3X3 className="h-3.5 w-3.5" /></button>
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md ${viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><List className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-xs font-medium">{selected.size} selected</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
          <Button variant="destructive" size="sm" className="h-6 text-xs gap-1" onClick={handleBulkDelete}><Trash2 className="h-3 w-3" />Delete</Button>
        </div>
      )}

      {/* Grid / List */}
      {media.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No media files yet</p>
          <Button variant="outline" size="sm" onClick={() => setShowUpload(true)} className="gap-1"><Upload className="h-3.5 w-3.5" />Upload First File</Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {media.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              isSelected={selected.has(item.id)}
              onOpen={() => openDetail(item)}
              onToggleSelect={() => toggleSelect(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {media.map((item) => (
            <MediaListRow key={item.id} item={item} onOpen={() => openDetail(item)} />
          ))}
        </div>
      )}

      <MediaDetailDrawer
        item={detailItem}
        folders={folders}
        editAlt={editAlt}
        editFolder={editFolder}
        editTags={editTags}
        isSaving={isSavingDetail}
        onClose={() => setDetailItem(null)}
        setEditAlt={setEditAlt}
        setEditFolder={setEditFolder}
        setEditTags={setEditTags}
        onSave={handleSaveDetail}
        onDelete={handleDelete}
      />
    </div>
  )
}
