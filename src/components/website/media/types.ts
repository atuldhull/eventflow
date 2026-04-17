export interface MediaItem {
  id: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  altText: string | null
  folder: string
  tags: string[]
  width: number | null
  height: number | null
  createdAt: string
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function sizeWarning(bytes: number) {
  if (bytes > 5 * 1024 * 1024) return { icon: "\u26A0\uFE0F", text: "Large file", color: "text-amber-600" }
  if (bytes > 2 * 1024 * 1024) return { icon: "\uD83D\uDCA1", text: "Consider compressing", color: "text-blue-600" }
  return null
}
