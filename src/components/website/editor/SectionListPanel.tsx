"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Eye, EyeOff, MoreVertical, Plus, Pencil, Copy, Trash2, ChevronUp, ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEditorStore } from "@/stores/useEditorStore"
import { SECTION_REGISTRY, getAllSectionCategories } from "@/lib/site-builder/sections"
import { generateId } from "@/lib/utils"
import type { SectionConfig } from "@/types/site-builder"

// ── Sortable Section Item ──
function SortableSectionItem({ section, isSelected }: { section: SectionConfig; isSelected: boolean }) {
  const { selectSection, toggleSectionVisibility, duplicateSection, removeSection, reorderSections, siteConfig } = useEditorStore()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const def = SECTION_REGISTRY[section.type]

  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.5 : 1 }
  const contentPreview = section.content?.title || section.content?.heading || section.content?.missionText || ""

  return (
    <div ref={setNodeRef} style={style} className={`group relative flex items-center gap-1.5 px-2 py-2 rounded-lg border transition-colors cursor-pointer ${isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50"} ${!section.enabled ? "opacity-50" : ""}`}
      onClick={() => selectSection(section.id)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Drag to reorder ${def?.name || section.type} section`}
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{def?.name || section.type}{!section.enabled && <span className="text-muted-foreground ml-1">(hidden)</span>}</p>
        {contentPreview && <p className="text-[10px] text-muted-foreground truncate">{String(contentPreview).slice(0, 35)}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id) }}
          className="p-1 rounded hover:bg-muted"
          title={section.enabled ? "Hide section" : "Show section"}
          aria-label={section.enabled ? "Hide section" : "Show section"}
          aria-pressed={!section.enabled}
        >
          {section.enabled ? <Eye className="h-3 w-3 text-muted-foreground" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
        </button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="p-1 rounded hover:bg-muted"
            title="More actions"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={showMenu}
          >
            <MoreVertical className="h-3 w-3 text-muted-foreground" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg py-1 w-36">
                <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted" onClick={(e) => { e.stopPropagation(); selectSection(section.id); setShowMenu(false) }}>
                  <Pencil className="h-3 w-3" />Edit
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted" onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); setShowMenu(false) }}>
                  <Copy className="h-3 w-3" />Duplicate
                </button>
                <div className="h-px bg-border my-1" />
                <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-muted" onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(true) }}>
                  <Trash2 className="h-3 w-3" />Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this section?</DialogTitle>
            <DialogDescription>
              {def?.name ? `The "${def.name}" section` : "This section"} will be removed from your website.
              You can undo this action with Ctrl/Cmd+Z while the editor is open.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { removeSection(section.id); setShowDeleteConfirm(false) }}>
              <Trash2 className="h-4 w-4" />
              Delete section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Section Picker Modal ──
function SectionPicker({ onClose }: { onClose: () => void }) {
  const { addSection } = useEditorStore()
  const [search, setSearch] = useState("")
  const categories = getAllSectionCategories()

  const sections = useMemo(() => {
    const all = Object.values(SECTION_REGISTRY)
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
  }, [search])

  const handleAdd = (sectionType: string) => {
    const def = SECTION_REGISTRY[sectionType]
    if (!def) return
    const newSection: SectionConfig = {
      id: generateId("sec"),
      type: sectionType,
      enabled: true,
      order: 0,
      config: { ...def.defaultConfig },
      content: { ...def.defaultContent },
    }
    addSection(newSection)
    onClose()
  }

  const groupedSections = useMemo(() => {
    const groups: Record<string, typeof sections> = {}
    sections.forEach((s) => {
      if (!groups[s.category]) groups[s.category] = []
      groups[s.category].push(s)
    })
    return groups
  }, [sections])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div className="bg-background rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Add Section</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="px-4 py-2 border-b">
          <div className="relative"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sections..." className="pl-8 h-8 text-sm" /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(groupedSections).map(([category, items]) => {
            const cat = categories.find((c) => c.id === category)
            return (
              <div key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{cat?.name || category}</h4>
                <div className="space-y-1.5">
                  {items.map((section) => (
                    <button key={section.id} onClick={() => handleAdd(section.id)} className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:border-primary/30 hover:bg-muted/50 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{section.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {sections.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No sections match your search</p>}
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Component ──
export function SectionListPanel() {
  const { siteConfig, selectedSectionId } = useEditorStore()
  const [showPicker, setShowPicker] = useState(false)
  const { reorderSections } = useEditorStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sections = useMemo(() =>
    [...(siteConfig?.sections || [])].sort((a, b) => a.order - b.order)
  , [siteConfig?.sections])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderSections(String(active.id), String(over.id))
    }
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Sections</h3>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowPicker(true)}>
            <Plus className="h-3 w-3" />Add
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sections.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">No sections yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowPicker(true)} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Section</Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section) => (
                  <SortableSectionItem key={section.id} section={section} isSelected={selectedSectionId === section.id} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <AnimatePresence>{showPicker && <SectionPicker onClose={() => setShowPicker(false)} />}</AnimatePresence>
    </>
  )
}
