"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Undo2, Redo2, Monitor, Tablet, Smartphone, Save, Loader2, Check } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
      <div className="z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-2 sm:px-3">
        {/* Left */}
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href="/admin/org/website" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "text-muted-foreground" })} aria-label="Back to website">
            <ArrowLeft />
          </Link>
          {editingName ? (
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => { updateSiteName(nameValue); setEditingName(false) }}
              onKeyDown={(e) => { if (e.key === "Enter") { updateSiteName(nameValue); setEditingName(false) } }}
              aria-label="Site name"
              className="h-8 w-40 text-sm font-semibold sm:w-48"
              autoFocus
            />
          ) : (
            <button onClick={() => { setNameValue(siteConfig?.siteName || ""); setEditingName(true) }} className="max-w-[140px] truncate rounded-sm px-1 text-sm font-semibold hover:bg-accent sm:max-w-[220px]" title="Rename site">
              {siteConfig?.siteName || "My Website"}
            </button>
          )}
        </div>

        {/* Center */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={redo} disabled={redoStack.length === 0} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />

          <div className="hidden items-center rounded-md border p-0.5 sm:flex" role="group" aria-label="Preview size">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode)}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} Preview`}
                aria-label={`${mode.charAt(0).toUpperCase() + mode.slice(1)} preview`}
                aria-pressed={previewMode === mode}
                className={`flex size-7 items-center justify-center rounded-[4px] transition-colors pointer-coarse:size-9 ${previewMode === mode ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="mx-1 hidden h-4 w-px bg-border md:block" aria-hidden />
          <span className="hidden md:contents" role="status">
          {isSaving ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          ) : isDirty ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <span className="size-1.5 rounded-full bg-warning" />
              Unsaved changes
            </span>
          ) : lastSavedAt ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Your work is saved">
              <Check className="size-3 text-positive" />
              Saved {formatRelativeTime(lastSavedAt, now)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">All changes saved</span>
          )}
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? <Loader2 className="animate-spin" /> : justSaved ? <Check className="text-positive" /> : <Save />}
            {justSaved ? "Saved" : "Save"}
          </Button>
          <Button size="sm" onClick={() => setShowPublishConfirm(true)} disabled={isSaving}>
            {siteConfig?.isPublished ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Publish confirmation */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{siteConfig?.isPublished ? "Update your website?" : "Publish your website?"}</DialogTitle>
            <DialogDescription>
              {siteConfig?.isPublished ? "Changes will be live immediately." : "Your website will be live and publicly accessible."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)}>Cancel</Button>
            <Button onClick={handlePublish}>{siteConfig?.isPublished ? "Update" : "Publish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
