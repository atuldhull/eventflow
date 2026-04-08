"use client"

import { useState } from "react"
import { ImageIcon, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface Props { label: string; value: string; onChange: (v: string) => void; required?: boolean; description?: string }

export function ImageFieldEditor({ label, value, onChange, required, description }: Props) {
  const [showUrl, setShowUrl] = useState(false)

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {value ? (
        <div className="relative rounded-lg overflow-hidden border bg-muted aspect-video max-w-[200px]">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <Button variant="destructive" size="icon-sm" className="absolute top-1 right-1 h-6 w-6" onClick={() => onChange("")}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2">
          <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No image selected</p>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowUrl(true)}>Add Image URL</Button>
        </div>
      )}
      {(showUrl || value) && (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." className="text-xs h-8" />
      )}
    </div>
  )
}
