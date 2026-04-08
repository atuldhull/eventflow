"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { X, Search, Upload, ImageIcon, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <h3 className="font-semibold">Select Image</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {(["library", "upload"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {tab === "library" ? "Library" : "Upload"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "library" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Search..." className="pl-8 h-8 text-xs" />
                </div>
              </div>

              {/* Folder pills */}
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setActiveFolder("all")} className={`px-2 py-1 rounded-full text-[10px] font-medium ${activeFolder === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>All</button>
                {folders.map((f) => (
                  <button key={f} onClick={() => setActiveFolder(f)} className={`px-2 py-1 rounded-full text-[10px] font-medium ${activeFolder === f ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{f}</button>
                ))}
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : media.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">No images found. Upload your first image!</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {media.filter((m) => m.fileType.startsWith("image")).map((item) => (
                    <button key={item.id} onClick={() => setSelectedId(item.id)} onDoubleClick={() => { onSelect(item); onClose() }}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors relative ${selectedId === item.id ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/20"}`}>
                      {item.fileUrl ? <img src={item.fileUrl} alt={item.altText || item.fileName} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/20" /></div>}
                      {selectedId === item.id && <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5"><Check className="h-3 w-3 text-primary-foreground" /></div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Enter image URL to add</p>
                <Input value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="https://..." className="text-sm mb-2" />
                <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="File name (optional)" className="text-sm mb-3" />
                <Button onClick={handleUpload} disabled={!uploadUrl || isUploading} className="gap-1">
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Add Image
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSelect} disabled={!selectedId}>Select</Button>
        </div>
      </motion.div>
    </div>
  )
}
