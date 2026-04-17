"use client"

import { Upload, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  show: boolean
  uploadUrl: string
  uploadName: string
  uploadFolder: string
  folders: string[]
  isUploading: boolean
  setUploadUrl: (v: string) => void
  setUploadName: (v: string) => void
  setUploadFolder: (v: string) => void
  onUpload: () => void
  onCancel: () => void
}

export function UploadZone({ show, uploadUrl, uploadName, uploadFolder, folders, isUploading, setUploadUrl, setUploadName, setUploadFolder, onUpload, onCancel }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
          <Card className="p-4 space-y-3">
            <Label className="text-xs font-medium">Add Image</Label>
            <Input value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="Image URL (https://...)" className="text-sm" />
            <div className="flex gap-2">
              <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="File name" className="text-sm flex-1" />
              <select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-sm">
                <option value="general">General</option>
                {folders.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={onUpload} disabled={!uploadUrl || isUploading} className="gap-1">
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Add
              </Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
