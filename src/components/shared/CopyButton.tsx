"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  size?: "sm" | "default" | "icon"
}

export function CopyButton({ value, label, className, size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (size === "icon") {
    return (
      <Button variant="ghost" size="icon-sm" onClick={handleCopy} className={cn("transition-colors", className)} title="Copy">
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className={cn("gap-1.5 transition-all", copied && "text-green-600 border-green-200", className)}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label ? (copied ? "Copied!" : label) : (copied ? "Copied!" : "Copy")}
    </Button>
  )
}
