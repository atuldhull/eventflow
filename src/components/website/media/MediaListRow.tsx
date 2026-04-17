"use client"

import { FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatSize, type MediaItem } from "./types"

export function MediaListRow({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={onOpen}>
      <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
        {item.fileType.startsWith("image") && item.fileUrl
          ? <img src={item.fileUrl} alt="" className="w-full h-full object-cover" />
          : <FileText className="h-5 w-5 m-auto text-muted-foreground/20" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{item.fileName}</p>
        <p className="text-[10px] text-muted-foreground">{formatSize(item.fileSize)} &bull; {item.folder}</p>
      </div>
      {!item.altText && <Badge variant="outline" className="text-[9px] text-amber-600">No alt</Badge>}
      <Badge variant="secondary" className="text-[9px]">{item.folder}</Badge>
    </div>
  )
}
