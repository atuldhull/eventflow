"use client"

import { useState } from "react"
import { Globe, Copy, AlertTriangle, Trash2, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { useEditorStore } from "@/stores/useEditorStore"
import type { FooterConfig } from "@/types/site-builder"

export function SettingsPanel() {
  const { siteConfig, updateSiteIdentity, updateFooter, orgSlug, orgId } = useEditorStore()
  const [copied, setCopied] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  if (!siteConfig) return null
  const footer: FooterConfig = siteConfig.footer || { columns: [], copyright: "", showPoweredBy: true }
  const siteUrl = `${orgSlug || "org"}.eventflow.com`

  const copyUrl = () => {
    navigator.clipboard.writeText(siteUrl)
    setCopied(true)
    toast.success("URL copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    if (deleteConfirm !== `DELETE ${siteConfig.siteName}` || !orgId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/org/${orgId}/website`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) {
        toast.success("Website deleted")
        window.location.href = "/admin/org/website"
      } else toast.error(json.message)
    } catch { toast.error("Failed to delete") } finally { setIsDeleting(false) }
  }

  // Footer helpers
  const updateFooterField = (key: string, value: any) => updateFooter({ ...footer, [key]: value })
  const addFooterColumn = () => updateFooter({ ...footer, columns: [...(footer.columns || []), { title: "Links", links: [] }] })
  const removeFooterColumn = (idx: number) => updateFooter({ ...footer, columns: (footer.columns || []).filter((_, i) => i !== idx) })
  const updateColumn = (idx: number, field: string, value: any) => {
    const cols = [...(footer.columns || [])]
    cols[idx] = { ...cols[idx], [field]: value }
    updateFooter({ ...footer, columns: cols })
  }
  const addColumnLink = (colIdx: number) => {
    const cols = [...(footer.columns || [])]
    cols[colIdx] = { ...cols[colIdx], links: [...cols[colIdx].links, { label: "Link", href: "#" }] }
    updateFooter({ ...footer, columns: cols })
  }
  const updateColumnLink = (colIdx: number, linkIdx: number, field: string, value: string) => {
    const cols = [...(footer.columns || [])]
    const links = [...cols[colIdx].links]
    links[linkIdx] = { ...links[linkIdx], [field]: value }
    cols[colIdx] = { ...cols[colIdx], links }
    updateFooter({ ...footer, columns: cols })
  }
  const removeColumnLink = (colIdx: number, linkIdx: number) => {
    const cols = [...(footer.columns || [])]
    cols[colIdx] = { ...cols[colIdx], links: cols[colIdx].links.filter((_, i) => i !== linkIdx) }
    updateFooter({ ...footer, columns: cols })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0">
        <h3 className="font-semibold text-sm">Settings</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Site Identity */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site Identity</Label>
          <div className="space-y-1.5">
            <Label className="text-xs">Site Name *</Label>
            <Input value={siteConfig.siteName} onChange={(e) => updateSiteIdentity({ siteName: e.target.value })} className="text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tagline</Label>
            <Input value={siteConfig.tagline || ""} onChange={(e) => updateSiteIdentity({ tagline: e.target.value.slice(0, 100) })} placeholder="Your organization's tagline" className="text-sm h-9" />
            <p className="text-[10px] text-muted-foreground">{(siteConfig.tagline || "").length}/100</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={siteConfig.siteDescription || ""} onChange={(e) => updateSiteIdentity({ siteDescription: e.target.value.slice(0, 500) })} placeholder="About your organization" rows={3} className="text-sm" />
          </div>
        </div>

        {/* Site URL */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site URL</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-md border bg-muted/50 text-sm">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{siteUrl}</span>
            </div>
            <Button variant="outline" size="icon-sm" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Footer</Label>

          {/* Copyright */}
          <div className="space-y-1.5">
            <Label className="text-xs">Copyright Text</Label>
            <Input value={footer.copyright || ""} onChange={(e) => updateFooterField("copyright", e.target.value)} placeholder={`© ${new Date().getFullYear()} ${siteConfig.siteName}`} className="text-xs h-8" />
          </div>

          {/* Powered by */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show "Powered by EventFlow"</Label>
            <button onClick={() => updateFooterField("showPoweredBy", !footer.showPoweredBy)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${footer.showPoweredBy ? "bg-primary" : "bg-muted"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${footer.showPoweredBy ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Social Links */}
          <div className="space-y-1.5">
            <Label className="text-xs">Social Links</Label>
            {["instagram", "twitter", "linkedin", "youtube", "github", "whatsapp"].map((platform) => (
              <Input key={platform} value={(footer.socialLinks as any)?.[platform] || ""} onChange={(e) => updateFooterField("socialLinks", { ...(footer.socialLinks || {}), [platform]: e.target.value })}
                placeholder={platform.charAt(0).toUpperCase() + platform.slice(1) + " URL"} className="text-xs h-7" />
            ))}
          </div>

          {/* Footer Columns */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Footer Columns ({(footer.columns || []).length}/4)</Label>
              {(footer.columns || []).length < 4 && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={addFooterColumn}>+ Column</Button>
              )}
            </div>
            {(footer.columns || []).map((col, colIdx) => (
              <Card key={colIdx} className="p-2 space-y-1.5">
                <div className="flex items-center gap-1">
                  <Input value={col.title} onChange={(e) => updateColumn(colIdx, "title", e.target.value)} placeholder="Column Title" className="text-xs h-7 flex-1" />
                  <Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0" onClick={() => removeFooterColumn(colIdx)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                {col.links.map((link, linkIdx) => (
                  <div key={linkIdx} className="flex items-center gap-1 pl-2">
                    <Input value={link.label} onChange={(e) => updateColumnLink(colIdx, linkIdx, "label", e.target.value)} placeholder="Label" className="text-[10px] h-6 flex-1" />
                    <Input value={link.href} onChange={(e) => updateColumnLink(colIdx, linkIdx, "href", e.target.value)} placeholder="URL" className="text-[10px] h-6 flex-1" />
                    <button onClick={() => removeColumnLink(colIdx, linkIdx)} className="p-0.5"><Trash2 className="h-2.5 w-2.5 text-destructive" /></button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="h-5 text-[10px] w-full" onClick={() => addColumnLink(colIdx)}>+ Link</Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-xs font-semibold uppercase tracking-wider text-red-500">Danger Zone</Label>
          <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/30 text-xs" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete Website
          </Button>
          {showDelete && (
            <Card className="p-3 border-destructive/30 space-y-2">
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>This will permanently delete your website. Type <strong>DELETE {siteConfig.siteName}</strong> to confirm.</p>
              </div>
              <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={`DELETE ${siteConfig.siteName}`} className="text-xs h-8" />
              <div className="flex gap-1">
                <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleDelete}
                  disabled={deleteConfirm !== `DELETE ${siteConfig.siteName}` || isDeleting}>
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Delete
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowDelete(false); setDeleteConfirm("") }}>Cancel</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
