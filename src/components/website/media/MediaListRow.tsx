"use client"

import { ChevronRight, FileText } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { formatSize, type MediaItem } from "./types"

export function MediaListRow({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-raised ring-1 ring-border">
        {item.fileType.startsWith("image") && item.fileUrl
          // eslint-disable-next-line @next/next/no-img-element -- tenant media at arbitrary URLs
          ? <img src={item.fileUrl} alt="" className="size-full object-cover" />
          : <FileText className="size-4 text-faint" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.fileName}</p>
        <p className="text-[13px] text-muted-foreground tabular-nums">{formatSize(item.fileSize)} · {item.folder}</p>
      </div>
      {!item.altText && <Pill tone="warning">No alt</Pill>}
      <Pill className="max-sm:hidden">{item.folder}</Pill>
      <ChevronRight className="size-4 shrink-0 text-faint group-hover:text-foreground" aria-hidden />
    </button>
  )
}
