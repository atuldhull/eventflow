import { create } from "zustand"
import type { SectionConfig, SiteStyles, NavItem, FooterConfig } from "@/types/site-builder"

export interface SiteConfigState {
  id: string
  siteName: string
  tagline: string | null
  siteDescription: string | null
  favicon: string | null
  ogImage: string | null
  sections: SectionConfig[]
  styles: SiteStyles
  enabledFeatures: any[]
  navigation: NavItem[]
  footer: FooterConfig | null
  isPublished: boolean
  customCss: string | null
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string[]
  templateId: string
}

export type PanelView = "sections" | "section-editor" | "styles" | "navigation" | "settings" | "seo" | "pages"

interface EditorState {
  // Data
  siteConfig: SiteConfigState | null
  orgId: string | null
  orgSlug: string | null

  // UI
  selectedSectionId: string | null
  isDirty: boolean
  isSaving: boolean
  isLoaded: boolean
  previewMode: "desktop" | "tablet" | "mobile"
  leftPanelView: PanelView

  // Undo/Redo
  undoStack: SiteConfigState[]
  redoStack: SiteConfigState[]

  // Actions
  init: (config: SiteConfigState, orgId: string, orgSlug: string) => void
  pushUndo: () => void

  // Section actions
  selectSection: (id: string | null) => void
  updateSectionContent: (sectionId: string, key: string, value: any) => void
  updateSectionConfig: (sectionId: string, key: string, value: any) => void
  toggleSectionVisibility: (sectionId: string) => void
  addSection: (section: SectionConfig) => void
  removeSection: (sectionId: string) => void
  reorderSections: (activeId: string, overId: string) => void
  duplicateSection: (sectionId: string) => void

  // Style actions
  updateStyles: (updates: Partial<SiteStyles>) => void
  updateSiteName: (name: string) => void

  // Navigation actions
  updateNavigation: (items: NavItem[]) => void
  addNavItem: (item: NavItem) => void
  removeNavItem: (index: number) => void

  // Footer actions
  updateFooter: (footer: FooterConfig) => void

  // SEO actions
  updateSEO: (updates: Partial<Pick<SiteConfigState, "seoTitle" | "seoDescription" | "seoKeywords" | "ogImage">>) => void

  // Settings actions
  updateSiteIdentity: (updates: Partial<Pick<SiteConfigState, "siteName" | "tagline" | "siteDescription" | "favicon">>) => void

  // Preview
  setPreviewMode: (mode: "desktop" | "tablet" | "mobile") => void
  setLeftPanelView: (view: PanelView) => void

  // Undo/Redo
  undo: () => void
  redo: () => void

  // Save
  markDirty: () => void
  markSaved: () => void
  setSaving: (saving: boolean) => void
}

const MAX_UNDO = 50

export const useEditorStore = create<EditorState>((set, get) => ({
  siteConfig: null,
  orgId: null,
  orgSlug: null,
  selectedSectionId: null,
  isDirty: false,
  isSaving: false,
  isLoaded: false,
  previewMode: "desktop",
  leftPanelView: "sections",
  undoStack: [],
  redoStack: [],

  init: (config, orgId, orgSlug) => set({ siteConfig: config, orgId, orgSlug, isLoaded: true, isDirty: false, undoStack: [], redoStack: [] }),

  pushUndo: () => {
    const { siteConfig, undoStack } = get()
    if (!siteConfig) return
    const newStack = [...undoStack, JSON.parse(JSON.stringify(siteConfig))].slice(-MAX_UNDO)
    set({ undoStack: newStack, redoStack: [] })
  },

  selectSection: (id) => set({ selectedSectionId: id, leftPanelView: id ? "section-editor" : "sections" }),

  updateSectionContent: (sectionId, key, value) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    const sections = siteConfig.sections.map((s) =>
      s.id === sectionId ? { ...s, content: { ...s.content, [key]: value } } : s
    )
    set({ siteConfig: { ...siteConfig, sections }, isDirty: true })
  },

  updateSectionConfig: (sectionId, key, value) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    const sections = siteConfig.sections.map((s) =>
      s.id === sectionId ? { ...s, config: { ...s.config, [key]: value } } : s
    )
    set({ siteConfig: { ...siteConfig, sections }, isDirty: true })
  },

  toggleSectionVisibility: (sectionId) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    const sections = siteConfig.sections.map((s) =>
      s.id === sectionId ? { ...s, enabled: !s.enabled } : s
    )
    set({ siteConfig: { ...siteConfig, sections }, isDirty: true })
  },

  addSection: (section) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    const sections = [...siteConfig.sections, { ...section, order: siteConfig.sections.length }]
    set({ siteConfig: { ...siteConfig, sections }, isDirty: true, selectedSectionId: section.id, leftPanelView: "section-editor" })
  },

  removeSection: (sectionId) => {
    const { siteConfig, selectedSectionId } = get()
    if (!siteConfig) return
    get().pushUndo()
    const sections = siteConfig.sections.filter((s) => s.id !== sectionId).map((s, i) => ({ ...s, order: i }))
    set({ siteConfig: { ...siteConfig, sections }, isDirty: true, selectedSectionId: selectedSectionId === sectionId ? null : selectedSectionId, leftPanelView: selectedSectionId === sectionId ? "sections" : get().leftPanelView })
  },

  reorderSections: (activeId, overId) => {
    const { siteConfig } = get()
    if (!siteConfig || activeId === overId) return
    get().pushUndo()
    const sections = [...siteConfig.sections]
    const oldIdx = sections.findIndex((s) => s.id === activeId)
    const newIdx = sections.findIndex((s) => s.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const [moved] = sections.splice(oldIdx, 1)
    sections.splice(newIdx, 0, moved)
    const reordered = sections.map((s, i) => ({ ...s, order: i }))
    set({ siteConfig: { ...siteConfig, sections: reordered }, isDirty: true })
  },

  duplicateSection: (sectionId) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    const section = siteConfig.sections.find((s) => s.id === sectionId)
    if (!section) return
    get().pushUndo()
    const newId = `sec_${Math.random().toString(36).slice(2, 10)}`
    const idx = siteConfig.sections.findIndex((s) => s.id === sectionId)
    const newSection = { ...JSON.parse(JSON.stringify(section)), id: newId }
    const sections = [...siteConfig.sections]
    sections.splice(idx + 1, 0, newSection)
    const reordered = sections.map((s, i) => ({ ...s, order: i }))
    set({ siteConfig: { ...siteConfig, sections: reordered }, isDirty: true, selectedSectionId: newId })
  },

  updateStyles: (updates) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    set({ siteConfig: { ...siteConfig, styles: { ...siteConfig.styles, ...updates } }, isDirty: true })
  },

  updateSiteName: (name) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    set({ siteConfig: { ...siteConfig, siteName: name }, isDirty: true })
  },

  // Navigation
  updateNavigation: (items) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    set({ siteConfig: { ...siteConfig, navigation: items }, isDirty: true })
  },
  addNavItem: (item) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    set({ siteConfig: { ...siteConfig, navigation: [...siteConfig.navigation, item] }, isDirty: true })
  },
  removeNavItem: (index) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    const navigation = siteConfig.navigation.filter((_, i) => i !== index)
    set({ siteConfig: { ...siteConfig, navigation }, isDirty: true })
  },

  // Footer
  updateFooter: (footer) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    set({ siteConfig: { ...siteConfig, footer }, isDirty: true })
  },

  // SEO
  updateSEO: (updates) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    set({ siteConfig: { ...siteConfig, ...updates }, isDirty: true })
  },

  // Settings
  updateSiteIdentity: (updates) => {
    const { siteConfig } = get()
    if (!siteConfig) return
    get().pushUndo()
    set({ siteConfig: { ...siteConfig, ...updates }, isDirty: true })
  },

  setPreviewMode: (mode) => set({ previewMode: mode }),
  setLeftPanelView: (view) => set({ leftPanelView: view }),

  undo: () => {
    const { undoStack, siteConfig } = get()
    if (undoStack.length === 0 || !siteConfig) return
    const prev = undoStack[undoStack.length - 1]
    set({
      siteConfig: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, JSON.parse(JSON.stringify(siteConfig))],
      isDirty: true,
    })
  },

  redo: () => {
    const { redoStack, siteConfig } = get()
    if (redoStack.length === 0 || !siteConfig) return
    const next = redoStack[redoStack.length - 1]
    set({
      siteConfig: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, JSON.parse(JSON.stringify(siteConfig!))],
      isDirty: true,
    })
  },

  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false }),
  setSaving: (saving) => set({ isSaving: saving }),
}))
