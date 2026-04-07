"use client"

import { useState } from "react"
import { Copy, Check, Share2, Mail, Send, MessageCircle, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

interface ShareModalProps {
  url: string
  title: string
  description?: string
  trigger?: React.ReactElement
}

export function ShareModal({ url, title, description, trigger }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [inviteEmails, setInviteEmails] = useState("")

  const copyLink = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Link copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const shareText = `${title}${description ? `\n${description}` : ""}\n\n${url}`
  const encodedTitle = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(shareText)
  const encodedDesc = encodeURIComponent(description || title)

  const shareChannels = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}`,
      color: "bg-[#25D366] hover:bg-[#1fb855] text-white",
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: "bg-[#0088cc] hover:bg-[#0077b5] text-white",
      icon: <Send className="h-4 w-4" />,
    },
    {
      label: "Gmail",
      href: `https://mail.google.com/mail/?view=cm&su=${encodedTitle}&body=${encodeURIComponent(`${description || title}\n\nRegister here: ${url}`)}`,
      color: "bg-[#EA4335] hover:bg-[#d93025] text-white",
      icon: <Mail className="h-4 w-4" />,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${description || title}\n\nRegister here: ${url}`)}`,
      color: "bg-zinc-600 hover:bg-zinc-700 text-white",
      icon: <Mail className="h-4 w-4" />,
    },
    {
      label: "Twitter / X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-200 dark:hover:bg-zinc-300 text-white dark:text-zinc-900",
      icon: <span className="text-sm font-bold">𝕏</span>,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: "bg-[#0A66C2] hover:bg-[#004182] text-white",
      icon: <Link2 className="h-4 w-4" />,
    },
  ]

  const handleBulkInvite = () => {
    const emails = inviteEmails
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"))

    if (emails.length === 0) {
      toast.error("Please enter valid email addresses")
      return
    }

    // Open Gmail compose with all emails in BCC
    const gmailUrl = `https://mail.google.com/mail/?view=cm&bcc=${encodeURIComponent(emails.join(","))}&su=${encodedTitle}&body=${encodeURIComponent(`You're invited to ${title}!\n\n${description || ""}\n\nRegister here: ${url}`)}`
    window.open(gmailUrl, "_blank")
    toast.success(`Opening Gmail to invite ${emails.length} people`)
  }

  return (
    <Dialog>
      <DialogTrigger render={trigger || <Button variant="outline" size="sm" className="gap-2" />}>
        {!trigger && <><Share2 className="h-4 w-4" /> Share</>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share & Invite</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Copy Link */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Event Link</Label>
            <div className="flex gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Share via</Label>
            <div className="grid grid-cols-3 gap-2">
              {shareChannels.map((ch) => (
                <a
                  key={ch.label}
                  href={ch.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${ch.color}`}
                >
                  {ch.icon}
                  {ch.label}
                </a>
              ))}
            </div>
          </div>

          <Separator />

          {/* Bulk Email Invite */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Invite by Email</Label>
            <Textarea
              placeholder={"Enter email addresses separated by commas or new lines:\nemail1@example.com, email2@example.com"}
              rows={3}
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              className="text-xs"
            />
            <Button onClick={handleBulkInvite} className="w-full gap-2" size="sm">
              <Mail className="h-4 w-4" />
              Send Invites via Gmail
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
