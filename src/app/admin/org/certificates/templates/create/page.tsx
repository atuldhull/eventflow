"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

/** The certificate's own colours: saved with the template and used by the paper preview. */
const CERT_COLORS = { primary: "#1a1a1a", accent: "#c9a96e" }

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-rule pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function CreateTemplatePage() {
  const router = useRouter()
  const { currentOrganizationId } = useRBAC()
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("Participation")
  const [titleText, setTitleText] = useState("Certificate of Participation")
  const [bodyText, setBodyText] = useState("has successfully participated in {{event_title}} organized by {{organizer_name}} on {{event_date}}.")
  const [orientation, setOrientation] = useState("landscape")
  const [isDefault, setIsDefault] = useState(false)

  const handleSave = async () => {
    if (!name || !currentOrganizationId) { toast.error("Template name is required"); return }
    setIsSaving(true)
    try {
      const templateData = JSON.stringify({ type, orientation, titleText, bodyText, fontFamily: "serif", colors: { primary: CERT_COLORS.primary, accent: CERT_COLORS.accent } })
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/certificates/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, templateHtml: templateData, isDefault }),
      })
      const data = await res.json()
      if (data.success) { toast.success("Template created!"); router.push("/admin/org/certificates") }
      else toast.error(data.message)
    } catch { toast.error("Failed to save") }
    finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New certificate template"
        breadcrumbs={[{ label: "Certificates", href: "/admin/org/certificates" }, { label: "New template" }]}
        actions={
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />} Save template
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="gap-0 p-5">
          <div className="space-y-6">
            <FieldGroup title="Template">
              <div className="grid gap-1.5">
                <Label htmlFor="tpl-name">Name</Label>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Tech Fest 2026 Participation" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tpl-type">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v || "Participation")}>
                  <SelectTrigger id="tpl-type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Participation">Participation</SelectItem>
                    <SelectItem value="Achievement">Achievement</SelectItem>
                    <SelectItem value="Appreciation">Appreciation</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldGroup>

            <FieldGroup title="Content">
              <div className="grid gap-1.5">
                <Label htmlFor="tpl-title">Certificate title</Label>
                <Input id="tpl-title" value={titleText} onChange={(e) => setTitleText(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tpl-body">Body text</Label>
                <Textarea id="tpl-body" rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} aria-describedby="tpl-body-tags" />
                <p id="tpl-body-tags" className="text-xs text-muted-foreground">
                  Tags you can use:{" "}
                  <span className="font-mono">{"{{name}} {{event_title}} {{event_date}} {{organizer_name}} {{certificate_id}}"}</span>
                </p>
              </div>
            </FieldGroup>

            <FieldGroup title="Layout">
              <div className="grid gap-1.5">
                <Label htmlFor="tpl-orientation">Orientation</Label>
                <Select value={orientation} onValueChange={(v) => setOrientation(v || "landscape")}>
                  <SelectTrigger id="tpl-orientation" className="w-full">
                    <SelectValue>{(v: string) => (v === "portrait" ? "Portrait" : "Landscape")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Landscape</SelectItem>
                    <SelectItem value="portrait">Portrait</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="tpl-default">Set as default</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">Use for all new events</p>
                </div>
                <Switch id="tpl-default" checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
              </div>
            </FieldGroup>
          </div>
        </Card>

        {/* Preview: the certificate itself, always on paper white */}
        <Card className="gap-0 self-start p-0 lg:sticky lg:top-16">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3">
            <h2 className="text-[15px] font-semibold">Preview</h2>
            <span className="text-[13px] text-muted-foreground">{orientation === "landscape" ? "A4 landscape" : "A4 portrait"}</span>
          </div>
          <div className="bg-raised p-4 sm:p-6">
            <div
              className={cn(
                "mx-auto overflow-hidden rounded-[3px] bg-white ring-1 ring-border",
                orientation === "landscape" ? "aspect-[297/210] w-full" : "aspect-[210/297] w-full max-w-[420px]",
              )}
              style={{ color: CERT_COLORS.primary }}
              data-no-dim
            >
              <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="absolute inset-2 rounded-[2px] border-[3px] border-double" style={{ borderColor: CERT_COLORS.accent }} />
                <p className="mb-3 text-[10px] opacity-60">EventFlow</p>
                <h3 className="font-serif text-xl">{titleText || "Certificate Title"}</h3>
                <p className="mt-2 text-xs italic opacity-60">This is to certify that</p>
                <p className="mt-2 border-b-2 px-8 pb-1 font-serif text-2xl font-semibold" style={{ borderColor: CERT_COLORS.accent }}>John Doe</p>
                <p className="mt-3 max-w-[80%] text-xs leading-relaxed opacity-70">{bodyText.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                  const samples: Record<string, string> = { name: "John Doe", event_title: "Tech Summit 2026", event_date: "April 15, 2026", organizer_name: "Tech Club", certificate_id: "CERT-A3B7K2" }
                  return samples[key] || `{{${key}}}`
                })}</p>
                <p className="absolute bottom-3 left-4 font-mono text-[8px] opacity-60">CERT-A3B7K2</p>
                <p className="absolute right-4 bottom-3 font-mono text-[8px] opacity-60">Verify: VER-X8MN45PQ</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
