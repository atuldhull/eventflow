"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Pencil, FileText, Home, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useEditorStore } from "@/stores/useEditorStore"

interface SitePage {
  id: string
  title: string
  slug: string
  isPublished: boolean
  showInNav: boolean
  navOrder: number
}

export function PagesPanel() {
  const { orgId } = useEditorStore()
  const [pages, setPages] = useState<SitePage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newSlug, setNewSlug] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!orgId) return
    fetchPages()
  }, [orgId])

  async function fetchPages() {
    try {
      const res = await fetch(`/api/admin/org/${orgId}/website/pages`)
      const json = await res.json()
      if (json.success) setPages(json.data || [])
    } catch {} finally { setIsLoading(false) }
  }

  const handleCreate = async () => {
    if (!newTitle.trim() || !orgId) return
    setIsCreating(true)
    const slug = newSlug || newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    try {
      const res = await fetch(`/api/admin/org/${orgId}/website/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), slug, sections: [], showInNav: true }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Page created")
        setNewTitle(""); setNewSlug(""); setShowAdd(false)
        fetchPages()
      } else toast.error(json.message)
    } catch { toast.error("Failed to create") } finally { setIsCreating(false) }
  }

  const handleDelete = async (pageId: string) => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/admin/org/${orgId}/website/pages/${pageId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Page deleted"); fetchPages() }
      else toast.error(json.message)
    } catch { toast.error("Failed to delete") }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Pages</h3>
          <p className="text-[11px] text-muted-foreground">Manage site pages</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3" />Add Page
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {/* Homepage (always first) */}
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-muted/30">
          <Home className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium">Homepage</p>
            <p className="text-[10px] text-muted-foreground">/</p>
          </div>
          <Badge variant="secondary" className="text-[9px]">Auto</Badge>
        </div>

        {/* Custom pages */}
        {pages.map((page) => (
          <div key={page.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border hover:border-muted-foreground/20 transition-colors">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{page.title}</p>
              <p className="text-[10px] text-muted-foreground">/{page.slug}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {page.showInNav && <Badge variant="secondary" className="text-[9px]">Nav</Badge>}
              <Badge variant={page.isPublished ? "default" : "secondary"} className="text-[9px]">{page.isPublished ? "Live" : "Draft"}</Badge>
              <button onClick={() => handleDelete(page.id)} className="p-1 rounded hover:bg-muted">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          </div>
        ))}

        {pages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-4">No custom pages yet</p>
        )}

        {/* Add page form */}
        {showAdd && (
          <Card className="p-3 space-y-2 mt-2">
            <Label className="text-xs font-medium">New Page</Label>
            <Input value={newTitle} onChange={(e) => { setNewTitle(e.target.value); if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")) }} placeholder="Page Title" className="text-xs h-8" />
            <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="page-slug" className="text-xs h-8 font-mono" />
            <div className="flex gap-1">
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Create
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowAdd(false); setNewTitle(""); setNewSlug("") }}>Cancel</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
