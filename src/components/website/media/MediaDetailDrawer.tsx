"use client"

import { AlertTriangle, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { nativeSelectClass } from "./UploadZone"
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
    <Sheet open={!!item} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {item && (
          <>
            <SheetHeader className="border-b border-rule px-5 py-4 pr-12">
              <SheetTitle className="truncate">{item.fileName}</SheetTitle>
              <SheetDescription className="font-mono text-xs">{item.fileType}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-5 py-5">
              {item.fileType.startsWith("image") && item.fileUrl && (
                <div className="overflow-hidden rounded-lg bg-raised ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tenant media at arbitrary URLs */}
                  <img src={item.fileUrl} alt={item.altText || ""} className="max-h-64 w-full object-contain" />
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="media-alt">Alt text</Label>
                  <Input id="media-alt" value={editAlt} onChange={(e) => setEditAlt(e.target.value)} placeholder="Describe what this image shows" aria-describedby={!editAlt ? "media-alt-warn" : undefined} />
                  {!editAlt && (
                    <p id="media-alt-warn" className="flex items-center gap-1.5 text-xs text-warning">
                      <AlertTriangle className="size-3.5" aria-hidden />Missing alt text — needed for accessibility
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="media-folder">Folder</Label>
                  <select id="media-folder" value={editFolder} onChange={(e) => setEditFolder(e.target.value)} className={`${nativeSelectClass} w-full`}>
                    {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="media-tags">Tags</Label>
                  <Input id="media-tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="hero, banner, outdoor" aria-describedby="media-tags-hint" />
                  <p id="media-tags-hint" className="text-xs text-muted-foreground">Separate tags with commas.</p>
                </div>
              </div>

              <dl className="divide-y divide-rule rounded-lg border text-[13px]">
                <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Type</dt><dd className="font-mono">{item.fileType}</dd></div>
                {item.width && (
                  <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Dimensions</dt><dd className="tabular-nums">{item.width} × {item.height} px</dd></div>
                )}
                <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Size</dt><dd className="tabular-nums">{formatSize(item.fileSize)}</dd></div>
                <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Uploaded</dt><dd className="tabular-nums">{new Date(item.createdAt).toLocaleDateString()}</dd></div>
              </dl>

              <div className="grid gap-1.5">
                <Label htmlFor="media-url">File URL</Label>
                <div className="flex gap-1.5">
                  <Input id="media-url" value={item.fileUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" className="shrink-0" aria-label="Copy file URL" onClick={() => { navigator.clipboard.writeText(item.fileUrl); toast.success("Copied!") }}>
                    <Copy />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-auto flex gap-2 border-t border-rule px-5 py-4">
              <Button variant="destructive" onClick={() => onDelete(item.id)}>Delete</Button>
              <Button onClick={onSave} disabled={isSaving} className="flex-1">
                {isSaving && <Loader2 className="animate-spin" />}Save
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
