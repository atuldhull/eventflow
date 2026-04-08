"use client"

import { Plus, Trash2, ImageIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface ImageItem { url: string; caption?: string; alt?: string }
interface Props { label: string; value: ImageItem[]; onChange: (v: ImageItem[]) => void; required?: boolean; description?: string }

export function ImageListEditor({ label, value, onChange, description }: Props) {
  const update = (idx: number, field: string, val: string) => onChange(value.map((img, i) => i === idx ? { ...img, [field]: val } : img))
  const add = () => onChange([...value, { url: "", caption: "", alt: "" }])
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      <div className="grid grid-cols-3 gap-2">
        {value.map((img, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
            {img.url ? <img src={img.url} alt={img.alt || ""} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground/30" /></div>}
            <Button variant="destructive" size="icon-sm" className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => remove(idx)}><Trash2 className="h-2.5 w-2.5" /></Button>
          </div>
        ))}
      </div>
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((img, idx) => (
            <Input key={idx} value={img.url} onChange={(e) => update(idx, "url", e.target.value)} placeholder={`Image ${idx + 1} URL`} className="text-xs h-7" />
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={add}><Plus className="h-3 w-3" />Add Image</Button>
    </div>
  )
}
