"use client"

import { FileText, Check } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
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
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg bg-card ring-1 transition-shadow",
        isSelected ? "ring-2 ring-brand" : "ring-border hover:ring-input",
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Open ${item.fileName}`}>
        <div className="relative flex aspect-square items-center justify-center bg-raised">
          {isImage && item.fileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant media at arbitrary URLs
            <img src={item.fileUrl} alt={item.altText || item.fileName} className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="text-center">
              <FileText className="mx-auto size-7 text-faint" strokeWidth={1.5} aria-hidden />
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{item.fileType.split("/")[1]}</p>
            </div>
          )}
          {!item.altText && isImage && <Pill tone="warning" className="absolute right-1.5 bottom-1.5">No alt</Pill>}
        </div>
        <div className="border-t border-rule px-2.5 py-2">
          <p className="truncate text-[13px] font-medium">{item.fileName}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {item.width && item.height ? `${item.width}×${item.height} · ` : ""}{formatSize(item.fileSize)}
          </p>
        </div>
      </button>
      {/* Select */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        aria-label={`Select ${item.fileName}`}
        className={cn(
          "absolute top-2 left-2 flex size-6 items-center justify-center rounded-[4px] border transition-opacity pointer-coarse:opacity-100",
          isSelected
            ? "border-brand bg-brand text-brand-foreground opacity-100"
            : "border-border bg-background/90 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
        onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
      >
        {isSelected && <Check className="size-3.5" />}
      </button>
    </div>
  )
}
