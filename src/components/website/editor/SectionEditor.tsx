"use client"

import { useMemo } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEditorStore } from "@/stores/useEditorStore"
import { SECTION_REGISTRY } from "@/lib/site-builder/sections"
import { FieldRenderer } from "./fields/FieldRenderer"

export function SectionEditor() {
  const { siteConfig, selectedSectionId, selectSection, updateSectionContent, updateSectionConfig, setLeftPanelView } = useEditorStore()

  const section = useMemo(() =>
    siteConfig?.sections.find((s) => s.id === selectedSectionId)
  , [siteConfig?.sections, selectedSectionId])

  const sectionDef = section ? SECTION_REGISTRY[section.type] : null

  if (!section || !sectionDef) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <p>Select a section to edit</p>
        <Button variant="link" size="sm" onClick={() => { selectSection(null); setLeftPanelView("sections") }}>Back to Sections</Button>
      </div>
    )
  }

  const contentFields = Object.entries(sectionDef.contentSchema)
  const configFields = Object.entries(sectionDef.configSchema)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => { selectSection(null); setLeftPanelView("sections") }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-semibold text-sm">{sectionDef.name}</h3>
            <p className="text-[11px] text-muted-foreground">{sectionDef.description}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs section={section} sectionDef={sectionDef} contentFields={contentFields} configFields={configFields} />
    </div>
  )
}

function Tabs({ section, sectionDef, contentFields, configFields }: {
  section: any; sectionDef: any
  contentFields: [string, any][]; configFields: [string, any][]
}) {
  const { updateSectionContent, updateSectionConfig } = useEditorStore()
  const [activeTab, setActiveTab] = __useState("content")

  return (
    <>
      <div className="flex border-b shrink-0">
        {[
          { id: "content", label: "Content" },
          { id: "settings", label: "Settings" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === "content" && contentFields.map(([key, fieldDef]) => (
          <FieldRenderer
            key={key}
            fieldKey={key}
            fieldDef={fieldDef}
            value={section.content?.[key]}
            onChange={(val) => updateSectionContent(section.id, key, val)}
          />
        ))}

        {activeTab === "settings" && configFields.map(([key, fieldDef]) => (
          <FieldRenderer
            key={key}
            fieldKey={key}
            fieldDef={fieldDef}
            value={section.config?.[key]}
            onChange={(val) => updateSectionConfig(section.id, key, val)}
          />
        ))}
      </div>
    </>
  )
}

// Use React's useState — import alias to avoid shadowing
import { useState as __useState } from "react"
