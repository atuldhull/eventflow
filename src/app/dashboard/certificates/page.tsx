"use client"

import { useState, useEffect } from "react"
import { Award, Download, Share2, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Certificate {
  id: string
  certificateNumber: string
  recipientName: string
  type: string
  title: string
  issuedDate: string
  verificationCode: string
  status: string
  event: { title: string; slug: string; startDate: string; organization: { name: string } | null }
}

const typeColors: Record<string, string> = {
  PARTICIPATION: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  WINNER: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  RUNNER_UP: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  VOLUNTEER: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SPEAKER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/users/me/certificates")
        const data = await res.json()
        if (data.success) setCertificates(data.data)
      } catch { toast.error("Failed to load certificates") }
      finally { setIsLoading(false) }
    }
    fetch_()
  }, [])

  const handleDownload = (id: string) => window.open(`/api/certificates/${id}/download`, "_blank")

  const handleLinkedIn = (cert: Certificate) => {
    const year = new Date(cert.issuedDate).getFullYear()
    const month = new Date(cert.issuedDate).getMonth() + 1
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.title)}&organizationName=${encodeURIComponent(cert.event.organization?.name || "EventFlow")}&issueYear=${year}&issueMonth=${month}&certUrl=${encodeURIComponent(`${window.location.origin}/verify/${cert.verificationCode}`)}&certId=${encodeURIComponent(cert.certificateNumber)}`
    window.open(url, "_blank")
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <PageHeader title="My Certificates" description={`${certificates.length} certificate${certificates.length !== 1 ? "s" : ""} earned`} />

      {certificates.length === 0 ? (
        <div className="text-center py-16">
          <Award className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="font-medium">No certificates yet</p>
          <p className="text-sm text-muted-foreground mt-1">Attend events and earn certificates!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {certificates.map((cert) => (
            <Card key={cert.id} className="overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 flex items-center justify-center relative">
                <Award className="h-16 w-16 text-amber-500/30" />
                <Badge variant="secondary" className={cn("absolute top-3 right-3 text-[10px]", typeColors[cert.type] || "")}>{cert.type}</Badge>
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold">{cert.title}</h3>
                <p className="text-sm text-muted-foreground">{cert.event.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{cert.event.organization?.name}</span>
                  <span>•</span>
                  <span>{new Date(cert.issuedDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{cert.certificateNumber}</p>
              </div>
              <div className="flex border-t text-xs">
                <button onClick={() => handleDownload(cert.id)} className="flex-1 py-2.5 text-center hover:bg-accent transition-colors flex items-center justify-center gap-1">
                  <Download className="h-3 w-3" /> Download
                </button>
                <div className="w-px bg-border" />
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/verify/${cert.verificationCode}`); toast.success("Verification link copied!") }} className="flex-1 py-2.5 text-center hover:bg-accent transition-colors flex items-center justify-center gap-1">
                  <Share2 className="h-3 w-3" /> Share
                </button>
                <div className="w-px bg-border" />
                <button onClick={() => handleLinkedIn(cert)} className="flex-1 py-2.5 text-center hover:bg-accent transition-colors flex items-center justify-center gap-1">
                  <ExternalLink className="h-3 w-3" /> LinkedIn
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
