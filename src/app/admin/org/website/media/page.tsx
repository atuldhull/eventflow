"use client"

import { useState, useEffect } from "react"
import { Upload, Grid3X3, List, FolderPlus, Trash2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTableSearch } from "@/components/tables/DataTableToolbar"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"
import { type MediaItem, formatSize } from "@/components/website/media/types"
import { UPLOAD_IMAGE_MAX, UPLOAD_IMAGE_TYPES, UploadZone, nativeSelectClass } from "@/components/website/media/UploadZone"
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
  const [uploadFile, setUploadFile] = useState<File | null>(null)
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

  /**
   * A chosen file goes to POST /api/upload first (the server checks its bytes: JPG, PNG or
   * WebP up to 5 MB), then the returned /uploads/ URL is saved to the media library. With
   * no file, a pasted image URL is saved as before.
   */
  const handleUpload = async () => {
    if ((!uploadFile && !uploadUrl.trim()) || !currentOrganizationId) return
    setIsUploading(true)
    try {
      let fileUrl = uploadUrl.trim()
      let fileType = "image/jpeg"
      let fileSize: number | undefined
      let dims: { width: number; height: number } | null = null
      let fileName = uploadName.trim()

      if (uploadFile) {
        if (!UPLOAD_IMAGE_TYPES.includes(uploadFile.type)) { toast.error("Choose a JPG, PNG or WebP image"); return }
        if (uploadFile.size > UPLOAD_IMAGE_MAX) { toast.error("Images can be up to 5 MB"); return }
        const form = new FormData()
        form.append("file", uploadFile)
        const up = await fetch("/api/upload", { method: "POST", body: form })
        const upJson = await up.json().catch(() => ({}))
        if (!upJson.success) { toast.error(upJson.message || "Upload failed"); return }
        if (!String(upJson.data?.type ?? "").startsWith("image/")) { toast.error("Only images can go in the media library"); return }
        fileUrl = upJson.data.url
        fileType = upJson.data.type
        fileSize = upJson.data.size
        fileName ||= uploadFile.name
        dims = await createImageBitmap(uploadFile)
          .then((bitmap) => { const d = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return d })
          .catch(() => null)
      }

      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/media`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: fileName || "image", fileUrl, fileType, folder: uploadFolder,
          ...(fileSize ? { fileSize } : {}),
          ...(dims ? dims : {}),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(uploadFile ? "Image uploaded" : "Image added")
        setUploadUrl(""); setUploadName(""); setUploadFile(null); setShowUpload(false); fetchMedia()
      }
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
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const createFolder = () => {
    if (newFolderName) { setFolders([...folders, newFolderName]); setNewFolderName(""); setShowNewFolder(false); toast.success("Folder created") }
  }

  const firstLoad = isLoading && media.length === 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Media library"
        description={firstLoad ? "Loading files…" : `${media.length} files · ${formatSize(totalSize)} used`}
        breadcrumbs={[{ label: "Website", href: "/admin/org/website" }, { label: "Media" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowNewFolder(true)}><FolderPlus />New folder</Button>
            <Button onClick={() => setShowUpload(!showUpload)} aria-expanded={showUpload}><Upload />Upload</Button>
          </>
        }
      />

      <UploadZone
        show={showUpload}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        uploadUrl={uploadUrl}
        uploadName={uploadName}
        uploadFolder={uploadFolder}
        folders={folders}
        isUploading={isUploading}
        setUploadUrl={setUploadUrl}
        setUploadName={setUploadName}
        setUploadFolder={setUploadFolder}
        onUpload={handleUpload}
        onCancel={() => { setShowUpload(false); setUploadFile(null) }}
      />

      {/* New folder */}
      {showNewFolder && (
        <Card className="gap-0 p-0">
          <form onSubmit={(e) => { e.preventDefault(); createFolder() }} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5 sm:max-w-xs">
              <Label htmlFor="new-folder">Folder name</Label>
              <Input id="new-folder" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="folder-name" className="font-mono" autoFocus />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowNewFolder(false)} className="max-sm:flex-1">Cancel</Button>
              <Button type="submit" className="max-sm:flex-1">Create</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DataTableSearch
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchMedia()}
          placeholder="Search files"
          className="sm:w-64"
        />
        <div className="flex gap-2">
          <select aria-label="Folder" value={activeFolder} onChange={(e) => setActiveFolder(e.target.value)} className={cn(nativeSelectClass, "flex-1 sm:flex-none")}>
            <option value="all">All folders</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select aria-label="Sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={cn(nativeSelectClass, "flex-1 sm:flex-none")}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="largest">Largest</option>
          </select>
          <div className="flex shrink-0 items-center rounded-md border p-0.5" role="group" aria-label="View">
            <Button variant="ghost" size="icon-sm" onClick={() => setViewMode("grid")} aria-label="Grid view" aria-pressed={viewMode === "grid"} className={cn("rounded-[4px]", viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <Grid3X3 />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setViewMode("list")} aria-label="List view" aria-pressed={viewMode === "list"} className={cn("rounded-[4px]", viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <List />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-raised px-3 py-2" role="status">
          <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={handleBulkDelete}><Trash2 />Delete</Button>
        </div>
      )}

      {/* Grid / List */}
      {firstLoad ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-lg" />)}
        </div>
      ) : media.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No media files yet" description="Images you add here can be used anywhere on your website.">
          <Button variant="outline" onClick={() => setShowUpload(true)}><Upload />Upload first file</Button>
        </EmptyState>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
        <div className="divide-y divide-rule overflow-hidden rounded-lg border">
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
