"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, Images, Upload, Pencil, Star, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Album {
  id: string
  title: string
  data: { title: string; description?: string; coverUrl?: string; photoCount?: number }
  createdAt: string
}

interface Photo {
  id: string
  data: { url: string; caption?: string; uploadedBy?: string; isCover?: boolean }
}

interface PendingUpload {
  id: string
  data: { url: string; caption?: string; uploadedBy?: string; albumId: string }
}

export function PhotoGalleryAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Album form
  const [showAlbumForm, setShowAlbumForm] = useState(false)
  const [albumTitle, setAlbumTitle] = useState("")
  const [albumDesc, setAlbumDesc] = useState("")
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    fetchAlbums()
  }, [orgSlug, isPreview])

  async function fetchAlbums() {
    try {
      const res = await fetch(`/api/modules/photo-gallery/albums?orgSlug=${orgSlug}&status=all`)
      const json = await res.json()
      if (json.success) setAlbums(json.data)
    } catch {} finally { setIsLoading(false) }
  }

  async function fetchPhotos(albumId: string) {
    try {
      const res = await fetch(`/api/modules/photo-gallery/albums/${albumId}/photos?orgSlug=${orgSlug}`)
      const json = await res.json()
      if (json.success) setPhotos(json.data)
    } catch {}
  }

  const handleSaveAlbum = async () => {
    if (!albumTitle.trim()) { toast.error("Album title required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsSaving(true)
    try {
      const url = editingAlbum
        ? `/api/modules/photo-gallery/albums?orgSlug=${orgSlug}&albumId=${editingAlbum.id}`
        : `/api/modules/photo-gallery/albums?orgSlug=${orgSlug}`
      const method = editingAlbum ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: albumTitle, description: albumDesc }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editingAlbum ? "Album updated" : "Album created")
        setShowAlbumForm(false); setAlbumTitle(""); setAlbumDesc(""); setEditingAlbum(null)
        fetchAlbums()
      } else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const handleDeleteAlbum = async (albumId: string) => {
    if (isPreview) return
    try {
      const res = await fetch(`/api/modules/photo-gallery/albums?orgSlug=${orgSlug}&albumId=${albumId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Album deleted"); fetchAlbums() }
      else toast.error(json.message)
    } catch { toast.error("Failed to delete") }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  // Photo management for selected album
  if (selectedAlbum) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedAlbum(null); setPhotos([]) }} className="text-sm text-muted-foreground hover:underline">&larr; Albums</button>
          <h3 className="text-lg font-semibold">{selectedAlbum.data.title}</h3>
        </div>

        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Drag & drop photos here or click to upload</p>
          <Button variant="outline" size="sm" className="mt-2">Choose Files</Button>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                {photo.data.url ? (
                  <img src={photo.data.url} alt={photo.data.caption || ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Images className="h-6 w-6 text-muted-foreground/20" /></div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <Button variant="ghost" size="icon-sm" className="text-white h-7 w-7"><Star className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon-sm" className="text-white h-7 w-7"><Trash2 className="h-3 w-3" /></Button>
                </div>
                {photo.data.isCover && <Badge className="absolute top-1 left-1 text-[8px]">Cover</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-4">No photos yet. Upload some!</p>
        )}

        {/* Pending uploads moderation */}
        {config.moderateUploads && pendingUploads.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">Pending Uploads <Badge variant="secondary">{pendingUploads.length}</Badge></h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {pendingUploads.map(upload => (
                <div key={upload.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted border-2 border-amber-300">
                  {upload.data.url ? <img src={upload.data.url} alt="" className="w-full h-full object-cover" /> : <Images className="h-6 w-6 text-muted-foreground/20" />}
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 flex justify-center gap-1">
                    <Button size="icon-sm" variant="ghost" className="h-6 w-6 text-green-400"><Check className="h-3 w-3" /></Button>
                    <Button size="icon-sm" variant="ghost" className="h-6 w-6 text-red-400"><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Images className="h-5 w-5" /> Photo Gallery</h3>
        <Button size="sm" onClick={() => { setShowAlbumForm(true); setEditingAlbum(null); setAlbumTitle(""); setAlbumDesc("") }} className="gap-1"><Plus className="h-3.5 w-3.5" />Create Album</Button>
      </div>

      {showAlbumForm && (
        <Card className="p-4 space-y-3">
          <Label className="text-sm font-medium">{editingAlbum ? "Edit Album" : "New Album"}</Label>
          <Input value={albumTitle} onChange={e => setAlbumTitle(e.target.value)} placeholder="Album name" />
          <Textarea value={albumDesc} onChange={e => setAlbumDesc(e.target.value)} placeholder="Description (optional)" rows={2} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveAlbum} disabled={isSaving}>{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}{editingAlbum ? "Update" : "Create"}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAlbumForm(false); setEditingAlbum(null) }}>Cancel</Button>
          </div>
        </Card>
      )}

      {albums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {albums.map(album => (
            <Card key={album.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedAlbum(album); fetchPhotos(album.id) }}>
              <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                {album.data.coverUrl ? <img src={album.data.coverUrl} alt={album.data.title} className="w-full h-full object-cover" /> : <Images className="h-8 w-8 text-muted-foreground/20" />}
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{album.data.title}</p>
                  <p className="text-xs text-muted-foreground">{album.data.photoCount || 0} photos</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={e => { e.stopPropagation(); setEditingAlbum(album); setAlbumTitle(album.data.title); setAlbumDesc(album.data.description || ""); setShowAlbumForm(true) }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={e => { e.stopPropagation(); handleDeleteAlbum(album.id) }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No albums yet. Create your first album!</p>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Total albums: {albums.length} / {config.maxAlbums || 20}</p>
      </div>
    </div>
  )
}

export default PhotoGalleryAdmin
