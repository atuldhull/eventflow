"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, Search, Grid3X3, List, FolderPlus, Trash2, FolderInput, Tag, ImageIcon, FileText, Film, X, Copy, Download, AlertTriangle, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"

interface MediaItem {
  id: string; fileName: string; fileUrl: string; fileType: string
  fileSize: number; altText: string | null; folder: string; tags: string[]
  width: number | null; height: number | null; createdAt: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sizeWarning(bytes: number) {
  if (bytes > 5 * 1024 * 1024) return { icon: "⚠️", text: "Large file", color: "text-amber-600" }
  if (bytes > 2 * 1024 * 1024) return { icon: "💡", text: "Consider compressing", color: "text-blue-600" }
  return null
}

export default function MediaLibraryPage() {
  const { currentOrganizationId } = useRBAC()
  const [media, setMedia] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFolder, setActiveFolder] = useState("all")
  const [fileTypeFilter, setFileTypeFilter] = useState("all")
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

      {/* Upload zone */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Card className="p-4 space-y-3">
              <Label className="text-xs font-medium">Add Image</Label>
              <Input value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="Image URL (https://...)" className="text-sm" />
              <div className="flex gap-2">
                <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="File name" className="text-sm flex-1" />
                <select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-sm">
                  <option value="general">General</option>
                  {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpload} disabled={!uploadUrl || isUploading} className="gap-1">
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Add
                </Button>
                <Button variant="ghost" onClick={() => setShowUpload(false)}>Cancel</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Grid */}
      {media.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No media files yet</p>
          <Button variant="outline" size="sm" onClick={() => setShowUpload(true)} className="gap-1"><Upload className="h-3.5 w-3.5" />Upload First File</Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {media.map((item) => {
            const isSelected = selected.has(item.id)
            const warning = sizeWarning(item.fileSize)
            const isImage = item.fileType.startsWith("image")
            return (
              <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group relative">
                <Card className={`overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={() => openDetail(item)}>
                  <div className="aspect-square bg-muted relative flex items-center justify-center">
                    {isImage && item.fileUrl ? (
                      <img src={item.fileUrl} alt={item.altText || item.fileName} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="text-center"><FileText className="h-8 w-8 mx-auto text-muted-foreground/20" /><p className="text-[9px] text-muted-foreground mt-1">{item.fileType.split("/")[1]}</p></div>
                    )}
                    {/* Checkbox */}
                    <button className={`absolute top-1.5 left-1.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-opacity ${isSelected ? "bg-primary border-primary opacity-100" : "border-white/60 opacity-0 group-hover:opacity-100"}`}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </button>
                    {/* Warnings */}
                    {!item.altText && isImage && <span className="absolute bottom-1 right-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">No alt</span>}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-medium truncate">{item.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">{item.width && item.height ? `${item.width}×${item.height} • ` : ""}{formatSize(item.fileSize)}</p>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-1">
          {media.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(item)}>
              <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                {item.fileType.startsWith("image") && item.fileUrl ? <img src={item.fileUrl} alt="" className="w-full h-full object-cover" /> : <FileText className="h-5 w-5 m-auto text-muted-foreground/20" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.fileName}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(item.fileSize)} • {item.folder}</p>
              </div>
              {!item.altText && <Badge variant="outline" className="text-[9px] text-amber-600">No alt</Badge>}
              <Badge variant="secondary" className="text-[9px]">{item.folder}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {detailItem && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetailItem(null)}>
            <div className="absolute inset-0 bg-black/50" />
            <motion.div className="relative w-full max-w-md bg-background shadow-xl overflow-y-auto"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-sm">{detailItem.fileName}</h3>
                  <button onClick={() => setDetailItem(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
                </div>

                {/* Preview */}
                {detailItem.fileType.startsWith("image") && detailItem.fileUrl && (
                  <div className="rounded-lg overflow-hidden border bg-muted"><img src={detailItem.fileUrl} alt={detailItem.altText || ""} className="w-full object-contain max-h-64" /></div>
                )}

                {/* Edit fields */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Alt Text</Label>
                    <Input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} placeholder="Describe what this image shows" className="text-sm" />
                    {!editAlt && <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Missing alt text — needed for accessibility</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Folder</Label>
                    <select value={editFolder} onChange={(e) => setEditFolder(e.target.value)} className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                      {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tags (comma-separated)</Label>
                    <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="hero, banner, outdoor" className="text-sm" />
                  </div>
                </div>

                {/* File info */}
                <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
                  <p>Type: {detailItem.fileType}</p>
                  {detailItem.width && <p>Dimensions: {detailItem.width} × {detailItem.height} px</p>}
                  <p>Size: {formatSize(detailItem.fileSize)}</p>
                  <p>Uploaded: {new Date(detailItem.createdAt).toLocaleDateString()}</p>
                </div>

                {/* URL */}
                <div className="space-y-1">
                  <Label className="text-xs">File URL</Label>
                  <div className="flex gap-1">
                    <Input value={detailItem.fileUrl} readOnly className="text-xs h-8 font-mono" />
                    <Button variant="outline" size="icon-sm" className="h-8 w-8 shrink-0" onClick={() => { navigator.clipboard.writeText(detailItem.fileUrl); toast.success("Copied!") }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveDetail} disabled={isSavingDetail} className="flex-1">
                    {isSavingDetail ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Save
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(detailItem.id)}>Delete</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
