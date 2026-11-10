"use client"

import { useId, useState } from "react"
import { Copy, Check, Share2, Mail, Send, MessageCircle, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  const linkId = useId()
  const inviteId = useId()

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

  // Channels share one quiet button style: the brand is in the label, not a fill colour.
  const shareChannels = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}`,
      icon: <MessageCircle className="size-4" />,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      icon: <Send className="size-4" />,
    },
    {
      label: "Gmail",
      href: `https://mail.google.com/mail/?view=cm&su=${encodedTitle}&body=${encodeURIComponent(`${description || title}\n\nRegister here: ${url}`)}`,
      icon: <Mail className="size-4" />,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${description || title}\n\nRegister here: ${url}`)}`,
      icon: <Mail className="size-4" />,
    },
    {
      label: "Twitter / X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: <span className="text-sm leading-none font-semibold" aria-hidden>𝕏</span>,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <Link2 className="size-4" />,
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
        {!trigger && <><Share2 className="size-4" /> Share</>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Share this event</DialogTitle>
          <DialogDescription className="line-clamp-1">{title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Copy link */}
          <div className="space-y-2">
            <Label htmlFor={linkId} className="text-[13px] font-normal text-muted-foreground">Event link</Label>
            <div className="flex gap-2">
              <Input id={linkId} value={url} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" onClick={copyLink} className="shrink-0" aria-label={copied ? "Link copied" : "Copy link"}>
                {copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>

          {/* Share channels */}
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">Share via</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {shareChannels.map((ch) => (
                <a
                  key={ch.label}
                  href={ch.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-[13px] font-medium transition-colors hover:bg-accent pointer-coarse:h-11"
                >
                  <span className="text-muted-foreground">{ch.icon}</span>
                  {ch.label}
                </a>
              ))}
            </div>
          </div>

          {/* Invite by email */}
          <div className="space-y-2 border-t border-rule pt-5">
            <Label htmlFor={inviteId} className="text-[13px] font-normal text-muted-foreground">Invite by email</Label>
            <Textarea
              id={inviteId}
              placeholder={"Email addresses, separated by commas or new lines"}
              rows={3}
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              className="text-sm"
            />
            <Button onClick={handleBulkInvite} variant="outline" className="w-full gap-2">
              <Mail className="size-4" />
              Send invites via Gmail
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
