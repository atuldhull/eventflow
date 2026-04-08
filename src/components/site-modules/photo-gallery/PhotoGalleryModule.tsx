"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Images, X, ChevronLeft, ChevronRight, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Album {
  id: string
  title: string
  description?: string
  data: { title: string; description?: string; coverUrl?: string; photoCount?: number }
  createdAt: string
}

interface Photo {
  id: string
  data: { url: string; caption?: string; uploadedBy?: string }
}

const SAMPLE_ALBUMS: Album[] = [
  { id: "a1", title: "Marathon 2026", data: { title: "Marathon 2026", coverUrl: "", photoCount: 24 }, createdAt: "2026-03-15" },
  { id: "a2", title: "Training Sessions", data: { title: "Training Sessions", coverUrl: "", photoCount: 18 }, createdAt: "2026-02-20" },
  { id: "a3", title: "Team Photos", data: { title: "Team Photos", coverUrl: "", photoCount: 12 }, createdAt: "2026-01-10" },
]

const SAMPLE_PHOTOS: Photo[] = [
  { id: "p1", data: { url: "", caption: "Starting line" } },
  { id: "p2", data: { url: "", caption: "Finish line celebration" } },
  { id: "p3", data: { url: "", caption: "Medal ceremony" } },
  { id: "p4", data: { url: "", caption: "Group photo" } },
  { id: "p5", data: { url: "", caption: "Training warmup" } },
  { id: "p6", data: { url: "", caption: "Post-run refreshments" } },
]

export function PhotoGalleryModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [photosLoading, setPhotosLoading] = useState(false)

  useEffect(() => {
    if (isPreview) { setAlbums(SAMPLE_ALBUMS); setIsLoading(false); return }
    async function fetch_() {
      try {
        const res = await fetch(`/api/modules/photo-gallery/albums?orgSlug=${orgSlug}`)
        const json = await res.json()
        if (json.success) setAlbums(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, isPreview])

  const openAlbum = async (album: Album) => {
    setSelectedAlbum(album)
    setPhotosLoading(true)
    if (isPreview) { setPhotos(SAMPLE_PHOTOS); setPhotosLoading(false); return }
    try {
      const res = await fetch(`/api/modules/photo-gallery/albums/${album.id}/photos?orgSlug=${orgSlug}`)
      const json = await res.json()
      if (json.success) setPhotos(json.data)
    } catch {} finally { setPhotosLoading(false) }
  }

  const navigateLightbox = useCallback((dir: number) => {
    if (lightboxIdx === null) return
    const next = lightboxIdx + dir
    if (next >= 0 && next < photos.length) setLightboxIdx(next)
  }, [lightboxIdx, photos.length])

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null)
      if (e.key === "ArrowLeft") navigateLightbox(-1)
      if (e.key === "ArrowRight") navigateLightbox(1)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [lightboxIdx, navigateLightbox])

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  // Album detail view
  if (selectedAlbum) {
    const layout = config.layout || "masonry"
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedAlbum(null); setPhotos([]) }} className="text-sm text-muted-foreground hover:underline">&larr; All Albums</button>
          <h3 className="text-xl font-bold">{selectedAlbum.data.title}</h3>
        </div>
        {selectedAlbum.data.description && <p className="text-sm text-muted-foreground">{selectedAlbum.data.description}</p>}

        {config.allowUploads && (
          <Button variant="outline" size="sm" className="gap-1"><Upload className="h-3.5 w-3.5" />Upload Photo</Button>
        )}

        {photosLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : photos.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No photos in this album yet</p>
        ) : (
          <div className={
            layout === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" :
            layout === "justified" ? "flex flex-wrap gap-2" :
            "columns-2 sm:columns-3 md:columns-4 gap-2 space-y-2"
          }>
            {photos.map((photo, idx) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`${layout === "justified" ? "h-40 flex-grow" : ""} cursor-pointer overflow-hidden rounded-lg group relative`}
                onClick={() => config.enableLightbox !== false && setLightboxIdx(idx)}
              >
                <div className={`bg-muted ${layout === "grid" ? "aspect-square" : layout === "justified" ? "h-full w-40" : "aspect-auto"} w-full flex items-center justify-center`}>
                  {photo.data.url ? (
                    <img src={photo.data.url} alt={photo.data.caption || ""} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Images className="h-8 w-8 text-muted-foreground/30" />
                  )}
                </div>
                {config.showCaptions !== false && photo.data.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{photo.data.caption}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        <AnimatePresence>
          {lightboxIdx !== null && photos[lightboxIdx] && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLightboxIdx(null)}
            >
              <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxIdx(null)}>
                <X className="h-6 w-6" />
              </button>
              {lightboxIdx > 0 && (
                <button className="absolute left-4 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); navigateLightbox(-1) }}>
                  <ChevronLeft className="h-8 w-8" />
                </button>
              )}
              {lightboxIdx < photos.length - 1 && (
                <button className="absolute right-4 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); navigateLightbox(1) }}>
                  <ChevronRight className="h-8 w-8" />
                </button>
              )}
              <div className="max-w-4xl max-h-[80vh] px-12" onClick={(e) => e.stopPropagation()}>
                {photos[lightboxIdx].data.url ? (
                  <img src={photos[lightboxIdx].data.url} alt={photos[lightboxIdx].data.caption || ""} className="max-w-full max-h-[75vh] object-contain mx-auto" />
                ) : (
                  <div className="w-96 h-64 bg-muted rounded-lg flex items-center justify-center"><Images className="h-12 w-12 text-muted-foreground/30" /></div>
                )}
                {photos[lightboxIdx].data.caption && (
                  <p className="text-center text-white/80 text-sm mt-3">{photos[lightboxIdx].data.caption}</p>
                )}
                <p className="text-center text-white/40 text-xs mt-1">{lightboxIdx + 1} / {photos.length}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Album grid view
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold flex items-center gap-2"><Images className="h-5 w-5" /> Photo Gallery</h3>
      {albums.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No albums yet</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {albums.map((album, idx) => (
            <motion.div key={album.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card
                className="overflow-hidden cursor-pointer group hover:shadow-md transition-shadow"
                onClick={() => openAlbum(album)}
              >
                <div className="aspect-[4/3] bg-muted relative flex items-center justify-center">
                  {album.data.coverUrl ? (
                    <img src={album.data.coverUrl} alt={album.data.title} className="w-full h-full object-cover" />
                  ) : (
                    <Images className="h-10 w-10 text-muted-foreground/20" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <h4 className="text-white font-semibold">{album.data.title}</h4>
                    <p className="text-white/70 text-xs">{album.data.photoCount || 0} photos</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PhotoGalleryModule
