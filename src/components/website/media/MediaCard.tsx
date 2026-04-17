"use client"

import { motion } from "framer-motion"
import { FileText, Check } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatSize, type MediaItem } from "./types"

interface Props {
  item: MediaItem
  isSelected: boolean
  onOpen: () => void
  onToggleSelect: () => void
}

export function MediaCard({ item, isSelected, onOpen, onToggleSelect }: Props) {
  const isImage = item.fileType.startsWith("image")

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group relative">
      <Card className={`overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={onOpen}>
        <div className="aspect-square bg-muted relative flex items-center justify-center">
          {isImage && item.fileUrl ? (
            <img src={item.fileUrl} alt={item.altText || item.fileName} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="text-center"><FileText className="h-8 w-8 mx-auto text-muted-foreground/20" /><p className="text-[9px] text-muted-foreground mt-1">{item.fileType.split("/")[1]}</p></div>
          )}
          {/* Checkbox */}
          <button className={`absolute top-1.5 left-1.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-opacity ${isSelected ? "bg-primary border-primary opacity-100" : "border-white/60 opacity-0 group-hover:opacity-100"}`}
            onClick={(e) => { e.stopPropagation(); onToggleSelect() }}>
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </button>
          {/* Warning */}
          {!item.altText && isImage && <span className="absolute bottom-1 right-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">No alt</span>}
        </div>
        <div className="p-2">
          <p className="text-[11px] font-medium truncate">{item.fileName}</p>
          <p className="text-[10px] text-muted-foreground">{item.width && item.height ? `${item.width}\u00D7${item.height} \u2022 ` : ""}{formatSize(item.fileSize)}</p>
        </div>
      </Card>
    </motion.div>
  )
}
