import type { Metadata } from "next"
import { CheckCircle, XCircle, HelpCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import prisma from "@/lib/prisma"

export const metadata: Metadata = { title: "Verify Certificate | EventFlow", robots: "noindex" }

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode: code },
    select: {
      certificateNumber: true, recipientName: true, type: true, title: true, issuedDate: true, status: true,
      event: { select: { title: true, startDate: true } },
    },
  }).catch(() => null)

  if (!certificate) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <HelpCircle className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold">Certificate Not Found</h1>
        <p className="text-muted-foreground mt-2">The verification code doesn&apos;t match any certificate in our system.</p>
      </div>
    )
  }

  if (certificate.status === "PENDING") {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Certificate Revoked</h1>
        <p className="text-muted-foreground mt-2">This certificate has been revoked by the issuing organization.</p>
        <p className="text-sm text-muted-foreground mt-1">Certificate #: {certificate.certificateNumber}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-20 max-w-md text-center space-y-6">
      <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
      <h1 className="text-2xl font-bold">Certificate Verified</h1>
      <Card className="p-6 text-left space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Certificate #</span><span className="font-mono">{certificate.certificateNumber}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Recipient</span><span className="font-medium">{certificate.recipientName}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span>{certificate.event.title}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Event Date</span><span>{certificate.event.startDate.toLocaleDateString("en-IN")}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Type</span><Badge variant="secondary">{certificate.type}</Badge></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Issued</span><span>{certificate.issuedDate.toLocaleDateString("en-IN")}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className="bg-green-100 text-green-700">Valid</Badge></div>
      </Card>
      <p className="text-xs text-muted-foreground">Verified on EventFlow — Professional Event Management Platform</p>
    </div>
  )
}
