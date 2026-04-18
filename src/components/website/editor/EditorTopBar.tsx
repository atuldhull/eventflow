"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Undo2, Redo2, Monitor, Tablet, Smartphone, Save, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useEditorStore } from "@/stores/useEditorStore"

function formatRelativeTime(then: number, now: number): string {
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 5) return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

interface EditorTopBarProps {
  onSave: () => Promise<void>
  onPublish: () => Promise<void>
}

export function EditorTopBar({ onSave, onPublish }: EditorTopBarProps) {
  const { siteConfig, isDirty, isSaving, previewMode, undoStack, redoStack, undo, redo, setPreviewMode, updateSiteName } = useEditorStore()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState("")
  const [justSaved, setJustSaved] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const handleSave = async () => {
    await onSave()
    setJustSaved(true)
    setLastSavedAt(Date.now())
    setTimeout(() => setJustSaved(false), 2000)
  }

  useEffect(() => {
    // When isSaving transitions from true -> false and we're no longer dirty, autosave succeeded
    if (!isSaving && !isDirty && lastSavedAt === null) {
      setLastSavedAt(Date.now())
    }
  }, [isSaving, isDirty, lastSavedAt])

  useEffect(() => {
    if (!isSaving && !isDirty && lastSavedAt !== null) {
      // Mark most-recent saved time when a save cycle completes
      setLastSavedAt(Date.now())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving])

  const handlePublish = async () => {
    setShowPublishConfirm(false)
    await onPublish()
  }

  return (
    <>
      <div className="h-14 border-b bg-background/95 backdrop-blur flex items-center justify-between px-3 gap-2 shrink-0 z-30">
        {/* Left */}
        <div className="flex items-center gap-2">
          <Link href="/admin/org/website">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          {editingName ? (
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => { updateSiteName(nameValue); setEditingName(false) }}
              onKeyDown={(e) => { if (e.key === "Enter") { updateSiteName(nameValue); setEditingName(false) } }}
              className="h-7 text-sm font-semibold w-48"
              autoFocus
            />
          ) : (
            <button onClick={() => { setNameValue(siteConfig?.siteName || ""); setEditingName(true) }} className="text-sm font-semibold hover:underline truncate max-w-[200px]">
              {siteConfig?.siteName || "My Website"}
            </button>
          )}
        </div>

        {/* Center */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={redo} disabled={redoStack.length === 0} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <div className="hidden sm:flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode)}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} Preview`}
                aria-label={`${mode.charAt(0).toUpperCase() + mode.slice(1)} preview`}
                aria-pressed={previewMode === mode}
                className={`p-1.5 rounded-md transition-colors ${previewMode === mode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border mx-1" />
          {isSaving ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          ) : isDirty ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          ) : lastSavedAt ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Your work is saved">
              <Check className="h-3 w-3 text-green-500" />
              Saved {formatRelativeTime(lastSavedAt, now)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">All changes saved</span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : justSaved ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Save className="h-3.5 w-3.5" />}
            {justSaved ? "Saved" : "Save"}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setShowPublishConfirm(true)} disabled={isSaving}>
            {siteConfig?.isPublished ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Publish confirmation */}
      {showPublishConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPublishConfirm(false)}>
          <div className="bg-background rounded-xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{siteConfig?.isPublished ? "Update your website?" : "Publish your website?"}</h3>
            <p className="text-sm text-muted-foreground">
              {siteConfig?.isPublished ? "Changes will be live immediately." : "Your website will be live and publicly accessible."}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowPublishConfirm(false)}>Cancel</Button>
              <Button size="sm" onClick={handlePublish}>{siteConfig?.isPublished ? "Update" : "Publish"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
