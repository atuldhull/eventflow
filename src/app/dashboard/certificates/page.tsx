"use client"

import { useState, useEffect } from "react"
import { Award, Download, Link2, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { statusLabel } from "@/lib/status-tone"

interface Certificate {
  id: string
  certificateNumber: string
  recipientName: string
  type: string
  title: string
  issuedDate: string
  verificationCode: string
  status: string
  state: "valid" | "not_issued" | "revoked"
  event: { title: string; slug: string; startDate: string; organization: { name: string } | null }
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

  // The route answers with the PDF as an attachment, so a link click saves it in place.
  const handleDownload = (id: string) => {
    const link = document.createElement("a")
    link.href = `/api/certificates/${id}/download`
    link.download = ""
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleLinkedIn = (cert: Certificate) => {
    const year = new Date(cert.issuedDate).getFullYear()
    const month = new Date(cert.issuedDate).getMonth() + 1
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.title)}&organizationName=${encodeURIComponent(cert.event.organization?.name || "EventFlow")}&issueYear=${year}&issueMonth=${month}&certUrl=${encodeURIComponent(`${window.location.origin}/verify/${cert.verificationCode}`)}&certId=${encodeURIComponent(cert.certificateNumber)}`
    window.open(url, "_blank")
  }

  const handleShare = (cert: Certificate) => {
    navigator.clipboard.writeText(`${window.location.origin}/verify/${cert.verificationCode}`)
    toast.success("Verification link copied!")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description={isLoading ? "Loading your certificates" : `${certificates.length} certificate${certificates.length !== 1 ? "s" : ""} earned`}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading certificates">
          {[0, 1].map((i) => <Skeleton key={i} className="h-[190px] rounded-lg" />)}
        </div>
      ) : certificates.length === 0 ? (
        <EmptyState icon={Award} title="No certificates yet" description="Attend events and earn certificates!" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {certificates.map((cert) => (
            <article key={cert.id} className="flex flex-col rounded-lg border bg-card">
              <div className="flex flex-1 p-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] leading-snug font-semibold">{cert.title}</h3>
                    {cert.state === "revoked" ? (
                      <Pill tone="negative" className="shrink-0">Revoked</Pill>
                    ) : (
                      <Pill className="shrink-0">{statusLabel(cert.type)}</Pill>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{cert.event.title}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {cert.event.organization?.name}
                    {cert.event.organization?.name && " · "}
                    <span className="tabular-nums">{new Date(cert.issuedDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </p>
                  <p className="pt-1 font-mono text-xs tracking-wide text-muted-foreground">{cert.certificateNumber}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-rule px-5 py-3">
                {cert.state === "valid" && (
                  <Button variant="outline" size="sm" onClick={() => handleDownload(cert.id)}>
                    <Download /> Download
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleShare(cert)}>
                  <Link2 /> Copy verify link
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleLinkedIn(cert)}>
                  <ExternalLink /> Add to LinkedIn
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
