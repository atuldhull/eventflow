"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical, Pencil, Check, X, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEditorStore } from "@/stores/useEditorStore"
import type { NavItem } from "@/types/site-builder"

export function NavigationPanel() {
  const { siteConfig, updateNavigation, addNavItem, removeNavItem } = useEditorStore()
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editHref, setEditHref] = useState("")
  const [editExternal, setEditExternal] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newHref, setNewHref] = useState("")

  if (!siteConfig) return null
  const nav = siteConfig.navigation || []

  const startEdit = (idx: number) => {
    const item = nav[idx]
    setEditingIdx(idx)
    setEditLabel(item.label)
    setEditHref(item.href)
    setEditExternal(item.external || false)
  }

  const saveEdit = () => {
    if (editingIdx === null || !editLabel.trim()) return
    const updated = nav.map((item, i) =>
      i === editingIdx ? { ...item, label: editLabel.trim(), href: editHref.trim(), external: editExternal } : item
    )
    updateNavigation(updated)
    setEditingIdx(null)
  }

  const handleAdd = () => {
    if (!newLabel.trim() || !newHref.trim()) return
    addNavItem({ label: newLabel.trim(), href: newHref.trim(), order: nav.length, external: false })
    setNewLabel("")
    setNewHref("")
    setShowAdd(false)
  }

  // Section anchors for suggestions
  const sectionAnchors = (siteConfig.sections || [])
    .filter((s) => s.enabled)
    .map((s) => {
      const type = s.type.split("-")[0]
      return { label: s.type.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()), href: `#${type}` }
    })
    .filter((a, i, arr) => arr.findIndex((b) => b.href === a.href) === i)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Navigation</h3>
          <p className="text-[11px] text-muted-foreground">Manage navbar links ({nav.length}/8)</p>
        </div>
        {nav.length < 8 && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3" />Add
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {/* Nav items */}
        {nav.map((item, idx) => (
          <div key={idx} className="border rounded-lg overflow-hidden">
            {editingIdx === idx ? (
              <div className="p-2.5 space-y-2">
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value.slice(0, 30))} placeholder="Label" className="text-xs h-7" />
                <Input value={editHref} onChange={(e) => setEditHref(e.target.value)} placeholder="/ or #section or https://..." className="text-xs h-7" />
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={editExternal} onChange={(e) => setEditExternal(e.target.checked)} />
                  Open in new tab
                </label>
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-[10px] gap-0.5" onClick={saveEdit}><Check className="h-3 w-3" />Save</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setEditingIdx(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-2">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
                    {item.href}{item.external && <ExternalLink className="h-2.5 w-2.5" />}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => startEdit(idx)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                  {idx > 0 && <button onClick={() => removeNavItem(idx)} className="p-1 rounded hover:bg-muted"><Trash2 className="h-3 w-3 text-destructive" /></button>}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add form */}
        {showAdd && (
          <div className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
            <Label className="text-xs font-medium">Add Navigation Link</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value.slice(0, 30))} placeholder="Label" className="text-xs h-7" />
            <Input value={newHref} onChange={(e) => setNewHref(e.target.value)} placeholder="URL" className="text-xs h-7" />
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-1">
              {sectionAnchors.slice(0, 5).map((a) => (
                <button key={a.href} onClick={() => { setNewLabel(a.label.split(" ")[0]); setNewHref(a.href) }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80">{a.href}</button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-[10px]" onClick={handleAdd}>Add</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Nav preview */}
        <div className="mt-4 p-2 rounded-lg border bg-muted/30">
          <p className="text-[10px] text-muted-foreground mb-1">Preview</p>
          <div className="flex items-center gap-3 text-xs font-medium overflow-x-auto">
            {nav.map((item, i) => (
              <span key={i} className="whitespace-nowrap" style={{ color: i === 0 ? siteConfig.styles.primaryColor : undefined }}>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
