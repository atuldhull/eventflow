"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Award, Download, Link2, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button, buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { statusLabel } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import { DashEmpty } from "../_components/bits"

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
        <div className="grid gap-5 lg:grid-cols-2" aria-busy="true" aria-label="Loading certificates">
          {[0, 1].map((i) => <Skeleton key={i} className="h-[260px] rounded-xl" />)}
        </div>
      ) : certificates.length === 0 ? (
        <DashEmpty title="No certificates yet" description="Attend events and earn certificates! When an organiser issues one, it shows up here, ready to download and share.">
          <Link href="/events" className={buttonVariants()}>Browse events</Link>
        </DashEmpty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {certificates.map((cert) => {
            const revoked = cert.state === "revoked"
            const issued = new Date(cert.issuedDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
            return (
              <article key={cert.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                {/* the certificate itself: a paper sheet with an inner rule, a seal and a signature line */}
                <div className="p-3">
                  <div
                    className={cn(
                      "relative rounded-lg border border-dashed border-foreground/15 bg-frame px-5 pt-5 pb-4 sm:px-6",
                      revoked && "opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        Certificate of {statusLabel(cert.type)}
                      </p>
                      {revoked && <Pill tone="negative" className="shrink-0">Revoked</Pill>}
                    </div>

                    <h3 className={cn("font-display mt-3 pr-14 text-[22px] leading-[1.15] font-bold tracking-[-0.03em]", revoked && "line-through decoration-1")}>
                      {cert.title}
                    </h3>
                    {cert.recipientName && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Awarded to <span className="font-medium text-foreground">{cert.recipientName}</span>
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-muted-foreground">{cert.event.title}</p>

                    <div className="mt-5 flex items-end justify-between gap-4 border-t border-foreground/10 pt-3">
                      <div className="min-w-0 text-[13px] text-muted-foreground">
                        <p className="truncate">
                          {cert.event.organization?.name}
                          {cert.event.organization?.name && " · "}
                          <span className="tabular-nums">{issued}</span>
                        </p>
                        <p className="mt-0.5 font-mono text-xs tracking-wide">{cert.certificateNumber}</p>
                      </div>
                    </div>

                    {/* the seal */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-12 right-5 flex size-12 items-center justify-center rounded-full border-2 border-dashed sm:right-6",
                        revoked ? "border-destructive/50 text-destructive" : "border-brand/60 text-brand",
                      )}
                    >
                      <Award className="size-5" strokeWidth={1.75} />
                    </span>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 px-4 pb-4">
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
            )
          })}
        </div>
      )}
    </div>
  )
}
