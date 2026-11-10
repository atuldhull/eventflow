"use client"

import { useState } from "react"
import { X, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useEditorStore } from "@/stores/useEditorStore"

function charCountColor(len: number, max: number) {
  if (len <= max * 0.8) return "text-positive"
  if (len <= max) return "text-warning"
  return "text-destructive"
}

export function SEOPanel() {
  const { siteConfig, updateSEO } = useEditorStore()
  const [keywordInput, setKeywordInput] = useState("")

  if (!siteConfig) return null

  const title = siteConfig.seoTitle || siteConfig.siteName || ""
  const description = siteConfig.seoDescription || ""
  const keywords = siteConfig.seoKeywords || []
  const ogImage = siteConfig.ogImage || ""

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (kw && keywords.length < 10 && !keywords.includes(kw)) {
      updateSEO({ seoKeywords: [...keywords, kw] })
      setKeywordInput("")
    }
  }

  const removeKeyword = (kw: string) => updateSEO({ seoKeywords: keywords.filter((k) => k !== kw) })

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0">
        <h3 className="font-semibold text-sm">SEO</h3>
        <p className="text-[11px] text-muted-foreground">Search engine optimization</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Basic SEO */}
        <div className="space-y-3">
          <Label className="text-[13px] font-semibold text-foreground">Basic SEO</Label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">SEO Title</Label>
              <span className={`text-[11px] tabular-nums ${charCountColor(title.length, 60)}`}>{title.length}/60</span>
            </div>
            <Input value={title} onChange={(e) => updateSEO({ seoTitle: e.target.value })} placeholder={siteConfig.siteName} className="text-sm h-9" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">SEO Description</Label>
              <span className={`text-[11px] tabular-nums ${charCountColor(description.length, 160)}`}>{description.length}/160</span>
            </div>
            <Textarea value={description} onChange={(e) => updateSEO({ seoDescription: e.target.value })} placeholder="Brief description for search engines" rows={3} className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Keywords ({keywords.length}/10)</Label>
            <div className="flex gap-1">
              <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword() } }}
                placeholder="Add keyword + Enter" className="text-xs h-8 flex-1" />
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addKeyword}>Add</Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => (
                  <span key={kw} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted">
                    {kw}
                    <button onClick={() => removeKeyword(kw)}><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Google Preview */}
        <div className="space-y-2">
          <Label className="text-[13px] font-semibold text-foreground">Google Preview</Label>
          <div className="p-3 space-y-0.5 rounded-lg border bg-background">
            <p className="truncate text-sm font-medium text-info">{title || siteConfig.siteName} | EventFlow</p>
            <p className="text-[11px] text-positive">{useEditorStore.getState().orgSlug || "org"}.eventflow.com</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{description || "No description set. Add a description to improve search visibility."}</p>
          </div>
        </div>

        {/* Social Sharing */}
        <div className="space-y-3">
          <Label className="text-[13px] font-semibold text-foreground">Social Sharing</Label>

          <div className="space-y-1.5">
            <Label className="text-xs">OG Image (1200x630 recommended)</Label>
            <Input value={ogImage} onChange={(e) => updateSEO({ ogImage: e.target.value })} placeholder="https://..." className="text-xs h-8" />
          </div>

          {/* Social Card Preview */}
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="aspect-[1200/630] bg-muted flex items-center justify-center">
              {ogImage ? <img src={ogImage} alt="OG" className="w-full h-full object-cover" /> : <Search className="h-8 w-8 text-muted-foreground/20" />}
            </div>
            <div className="p-2.5 border-t">
              <p className="text-[11px] text-muted-foreground">{useEditorStore.getState().orgSlug || "org"}.eventflow.com</p>
              <p className="text-xs font-medium truncate">{title || siteConfig.siteName}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
