"use client"

import { useState } from "react"
import { RotateCcw, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useEditorStore } from "@/stores/useEditorStore"
import type { SiteStyles } from "@/types/site-builder"

// WCAG contrast ratio calculation
function luminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g)?.map((c) => {
    const v = parseInt(c, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }) || [0, 0, 0]
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function contrastRatio(c1: string, c2: string): number {
  const l1 = luminance(c1)
  const l2 = luminance(c2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const COLOR_PRESETS: { name: string; colors: Partial<SiteStyles> }[] = [
  { name: "Dark Mode", colors: { backgroundColor: "#0F0F1A", textColor: "#F5F5F5", primaryColor: "#6C63FF", secondaryColor: "#1A1A2E", accentColor: "#FF6B6B" } },
  { name: "Light Clean", colors: { backgroundColor: "#FFFFFF", textColor: "#1E293B", primaryColor: "#1E40AF", secondaryColor: "#64748B", accentColor: "#F59E0B" } },
  { name: "Warm Earth", colors: { backgroundColor: "#FFF8F0", textColor: "#3D2B1F", primaryColor: "#D97706", secondaryColor: "#78350F", accentColor: "#EA580C" } },
  { name: "Ocean", colors: { backgroundColor: "#F0F9FF", textColor: "#0C4A6E", primaryColor: "#0891B2", secondaryColor: "#155E75", accentColor: "#06B6D4" } },
  { name: "Forest", colors: { backgroundColor: "#F0FDF4", textColor: "#14532D", primaryColor: "#059669", secondaryColor: "#064E3B", accentColor: "#10B981" } },
  { name: "Royal", colors: { backgroundColor: "#FFFFFF", textColor: "#1E1B4B", primaryColor: "#7C3AED", secondaryColor: "#4C1D95", accentColor: "#A855F7" } },
]

const FONTS = [
  "Inter", "Space Grotesk", "Plus Jakarta Sans", "JetBrains Mono", "Playfair Display",
  "Outfit", "DM Sans", "Clash Display", "Source Sans 3", "Nunito", "Poppins", "Raleway",
]

function ColorField({ label, description, value, onChange }: { label: string; description: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <p className="text-[10px] text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer shrink-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex h-8 w-24 rounded-md border border-input bg-transparent px-2 text-xs font-mono" />
      </div>
    </div>
  )
}

export function StylesPanel() {
  const { siteConfig, updateStyles } = useEditorStore()
  const [showCustomCss, setShowCustomCss] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  if (!siteConfig) return null
  const s = siteConfig.styles

  const textBgRatio = contrastRatio(s.textColor, s.backgroundColor)
  const textPrimaryRatio = contrastRatio(s.textColor, s.primaryColor)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0">
        <h3 className="font-semibold text-sm">Styles</h3>
        <p className="text-[11px] text-muted-foreground">Customize colors, fonts, and shapes</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Colors */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colors</Label>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowPresets(!showPresets)}>Presets</Button>
          </div>

          {showPresets && (
            <div className="grid grid-cols-2 gap-1.5">
              {COLOR_PRESETS.map((preset) => (
                <button key={preset.name} onClick={() => { updateStyles(preset.colors); setShowPresets(false) }}
                  className="p-2 rounded-lg border hover:border-primary/30 transition-colors text-left">
                  <div className="flex gap-1 mb-1">
                    {[preset.colors.primaryColor, preset.colors.secondaryColor, preset.colors.backgroundColor].filter(Boolean).map((c, i) => (
                      <div key={i} className="w-4 h-4 rounded-full border" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <p className="text-[10px] font-medium">{preset.name}</p>
                </button>
              ))}
            </div>
          )}

          <ColorField label="Primary Color" description="Buttons, links, accents" value={s.primaryColor} onChange={(v) => updateStyles({ primaryColor: v })} />
          <ColorField label="Secondary Color" description="Backgrounds, secondary elements" value={s.secondaryColor} onChange={(v) => updateStyles({ secondaryColor: v })} />
          <ColorField label="Accent Color" description="Highlights, badges, decorations" value={s.accentColor || s.primaryColor} onChange={(v) => updateStyles({ accentColor: v })} />
          <ColorField label="Background Color" description="Main page background" value={s.backgroundColor} onChange={(v) => updateStyles({ backgroundColor: v })} />
          <ColorField label="Text Color" description="Primary text color" value={s.textColor} onChange={(v) => updateStyles({ textColor: v })} />

          {/* Contrast checker */}
          <div className="p-2 rounded-lg bg-muted/50 space-y-1 text-[10px]">
            <p className="font-medium text-xs">Contrast Check</p>
            <div className="flex items-center justify-between">
              <span>Text on Background</span>
              <span className={`font-mono ${textBgRatio >= 4.5 ? "text-green-600" : "text-red-500"}`}>
                {textBgRatio.toFixed(1)}:1 {textBgRatio >= 4.5 ? "Pass" : "Fail"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Text on Primary</span>
              <span className={`font-mono ${textPrimaryRatio >= 3 ? "text-green-600" : "text-amber-500"}`}>
                {textPrimaryRatio.toFixed(1)}:1
              </span>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typography</Label>
          <div className="space-y-1">
            <Label className="text-xs">Heading Font</Label>
            <select value={s.fontHeading.replace(/'/g, "").split(",")[0].trim()} onChange={(e) => updateStyles({ fontHeading: `'${e.target.value}', sans-serif` })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <p className="text-sm font-bold mt-1" style={{ fontFamily: s.fontHeading }}>Preview Heading Text</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Body Font</Label>
            <select value={s.fontBody.replace(/'/g, "").split(",")[0].trim()} onChange={(e) => updateStyles({ fontBody: `'${e.target.value}', sans-serif` })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ fontFamily: s.fontBody }}>Preview body text showing how the font looks in a paragraph context.</p>
          </div>
        </div>

        {/* Buttons & Shape */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buttons & Shape</Label>
          <div className="space-y-1">
            <Label className="text-xs">Border Radius</Label>
            <input type="range" min={0} max={24} value={parseInt(s.borderRadius)} onChange={(e) => updateStyles({ borderRadius: `${e.target.value}px` })} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Sharp</span><span>{s.borderRadius}</span><span>Pill</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Button Style</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["rounded", "pill", "square"] as const).map((style) => (
                <button key={style} onClick={() => updateStyles({ buttonStyle: style })}
                  className={`p-2 rounded-lg border text-center text-xs transition-colors ${s.buttonStyle === style ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}>
                  <div className="mx-auto mb-1 px-3 py-1 text-[10px] text-white" style={{ backgroundColor: s.primaryColor, borderRadius: style === "pill" ? "9999px" : style === "square" ? "0" : "6px" }}>
                    Button
                  </div>
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Nav Style */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Navigation Style</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["transparent", "solid", "glass"] as const).map((style) => (
              <button key={style} onClick={() => updateStyles({ navStyle: style })}
                className={`p-2 rounded-lg border text-center text-[10px] transition-colors ${s.navStyle === style ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}>
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Style */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Footer Style</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["light", "dark", "colored"] as const).map((style) => (
              <button key={style} onClick={() => updateStyles({ footerStyle: style })}
                className={`p-2 rounded-lg border text-center text-[10px] transition-colors ${s.footerStyle === style ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}>
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Custom CSS */}
        <div className="space-y-2">
          <button onClick={() => setShowCustomCss(!showCustomCss)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {showCustomCss ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Advanced: Custom CSS
          </button>
          {showCustomCss && (
            <div className="space-y-1">
              <Textarea
                value={siteConfig.customCss || ""}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 10000)
                  useEditorStore.setState((state) => ({
                    siteConfig: state.siteConfig ? { ...state.siteConfig, customCss: val } : null, isDirty: true,
                  }))
                }}
                placeholder="/* Custom CSS rules */"
                rows={6}
                className="font-mono text-xs bg-zinc-950 text-zinc-100"
              />
              <p className="text-[10px] text-amber-600">Custom CSS can break your site. Use with caution.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
