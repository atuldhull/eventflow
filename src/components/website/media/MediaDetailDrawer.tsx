"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, AlertTriangle, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatSize, type MediaItem } from "./types"

interface Props {
  item: MediaItem | null
  folders: string[]
  editAlt: string
  editFolder: string
  editTags: string
  isSaving: boolean
  onClose: () => void
  setEditAlt: (v: string) => void
  setEditFolder: (v: string) => void
  setEditTags: (v: string) => void
  onSave: () => void
  onDelete: (id: string) => void
}

export function MediaDetailDrawer({ item, folders, editAlt, editFolder, editTags, isSaving, onClose, setEditAlt, setEditFolder, setEditTags, onSave, onDelete }: Props) {
  return (
    <AnimatePresence>
      {item && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
          <div className="absolute inset-0 bg-black/50" />
          <motion.div className="relative w-full max-w-md bg-background shadow-xl overflow-y-auto"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-sm">{item.fileName}</h3>
                <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {/* Preview */}
              {item.fileType.startsWith("image") && item.fileUrl && (
                <div className="rounded-lg overflow-hidden border bg-muted"><img src={item.fileUrl} alt={item.altText || ""} className="w-full object-contain max-h-64" /></div>
              )}

              {/* Edit fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Alt Text</Label>
                  <Input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} placeholder="Describe what this image shows" className="text-sm" />
                  {!editAlt && <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Missing alt text &mdash; needed for accessibility</p>}
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
                <p>Type: {item.fileType}</p>
                {item.width && <p>Dimensions: {item.width} &times; {item.height} px</p>}
                <p>Size: {formatSize(item.fileSize)}</p>
                <p>Uploaded: {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>

              {/* URL */}
              <div className="space-y-1">
                <Label className="text-xs">File URL</Label>
                <div className="flex gap-1">
                  <Input value={item.fileUrl} readOnly className="text-xs h-8 font-mono" />
                  <Button variant="outline" size="icon-sm" className="h-8 w-8 shrink-0" onClick={() => { navigator.clipboard.writeText(item.fileUrl); toast.success("Copied!") }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={onSave} disabled={isSaving} className="flex-1">
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Save
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>Delete</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
