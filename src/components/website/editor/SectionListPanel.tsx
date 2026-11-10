"use client"

import { useState, useMemo } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Eye, EyeOff, MoreVertical, Plus, Pencil, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTableSearch } from "@/components/tables/DataTableToolbar"
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
    <div ref={setNodeRef} style={style} className={`group relative flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1.5 transition-colors ${isSelected ? "border-brand/40 bg-brand/[0.06]" : "border-transparent hover:bg-muted/60"} ${!section.enabled ? "opacity-55" : ""}`}
      onClick={() => selectSection(section.id)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-faint hover:text-foreground active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Drag to reorder ${def?.name || section.type} section`}
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-medium">{def?.name || section.type}{!section.enabled && <span className="text-muted-foreground ml-1">(hidden)</span>}</p>
        {contentPreview && <p className="truncate text-[11px] text-muted-foreground">{String(contentPreview).slice(0, 35)}</p>}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 has-aria-expanded:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id) }}
          className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          title={section.enabled ? "Hide section" : "Show section"}
          aria-label={section.enabled ? "Hide section" : "Show section"}
          aria-pressed={!section.enabled}
        >
          {section.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
        <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            title="More actions"
            aria-label="More actions"
          >
            <MoreVertical className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => { selectSection(section.id); setShowMenu(false) }}>
              <Pencil />Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { duplicateSection(section.id); setShowMenu(false) }}>
              <Copy />Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => { setShowMenu(false); setShowDeleteConfirm(true) }}>
              <Trash2 />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete this section?</DialogTitle>
            <DialogDescription>
              {def?.name ? `The "${def.name}" section` : "This section"} will be removed from your website.
              You can undo this action with Ctrl/Cmd+Z while the editor is open.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { removeSection(section.id); setShowDeleteConfirm(false) }}>
              <Trash2 />
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-rule px-5 py-4">
          <DialogTitle>Add a section</DialogTitle>
          <DialogDescription>Pick a block to add to your page.</DialogDescription>
        </DialogHeader>
        <div className="border-b border-rule px-5 py-3">
          <DataTableSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sections" className="sm:w-full" />
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {Object.entries(groupedSections).map(([category, items]) => {
            const cat = categories.find((c) => c.id === category)
            return (
              <div key={category}>
                <h4 className="mb-2 text-[13px] font-medium text-muted-foreground">{cat?.name || category}</h4>
                <div className="divide-y divide-rule overflow-hidden rounded-lg border">
                  {items.map((section) => (
                    <button key={section.id} type="button" onClick={() => handleAdd(section.id)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{section.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{section.description}</p>
                      </div>
                      <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {sections.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No sections match your search</p>}
        </div>
      </DialogContent>
    </Dialog>
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
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
          <h3 className="text-sm font-semibold">Sections</h3>
          <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
            <Plus />Add
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sections.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">No sections yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}><Plus />Add section</Button>
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

      {showPicker && <SectionPicker onClose={() => setShowPicker(false)} />}
    </>
  )
}
