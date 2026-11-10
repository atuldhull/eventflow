import type { Metadata } from "next"
import Link from "next/link"
import { CircleCheck, CircleX, CircleHelp, Clock, type LucideIcon } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { Container } from "@/components/marketing/layout"
import { statusLabel } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import prisma from "@/lib/prisma"
import { VERIFICATION_CODE_PATTERN, certificateVerificationState, revokedAt } from "@/lib/certificate-verification"

export const metadata: Metadata = { title: "Verify certificate", robots: "noindex" }

/** the result's headline: a 24px status glyph in its status colour, then the title and a grey line */
function Result({ icon: Icon, tone, title, children }: { icon: LucideIcon; tone: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      <Icon className={cn("size-7", tone)} strokeWidth={1.75} aria-hidden />
      <h1 className="mt-4 text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{title}</h1>
      {children}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-16 sm:py-24">
      <div className="max-w-[560px]">
        {children}
        <Link href="/verify" className="mt-10 inline-flex text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Check another code
        </Link>
      </div>
    </Container>
  )
}

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  let code = rawCode.trim()
  try { code = decodeURIComponent(code).trim() } catch { /* not percent-encoded: use as is */ }

  const certificate = !VERIFICATION_CODE_PATTERN.test(code) ? null : await prisma.certificate.findUnique({
    where: { verificationCode: code },
    select: {
      certificateNumber: true, recipientName: true, type: true, title: true, issuedDate: true, status: true, metadata: true,
      event: { select: { title: true, startDate: true } },
    },
  }).catch(() => null)

  if (!certificate) {
    return (
      <Shell>
        <Result icon={CircleHelp} tone="text-muted-foreground" title="Certificate not found">
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">The verification code doesn&apos;t match any certificate in our system.</p>
        </Result>
      </Shell>
    )
  }

  const state = certificateVerificationState(certificate.status, certificate.metadata)
  const certNumber = (
    <p className="mt-2 text-sm text-muted-foreground">
      Certificate #: <span className="font-mono text-foreground">{certificate.certificateNumber}</span>
    </p>
  )

  if (state === "not_issued") {
    return (
      <Shell>
        <Result icon={Clock} tone="text-muted-foreground" title="Not issued yet">
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            This certificate exists but the issuing organization hasn&apos;t issued it yet, so it can&apos;t be verified. Check again once it has been issued.
          </p>
          {certNumber}
        </Result>
      </Shell>
    )
  }

  if (state === "revoked") {
    const when = revokedAt(certificate.metadata)
    return (
      <Shell>
        <Result icon={CircleX} tone="text-destructive" title="Certificate revoked">
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            This certificate has been revoked by the issuing organization{when ? ` on ${when.toLocaleDateString("en-IN")}` : ""} and is no longer valid.
          </p>
          {certNumber}
        </Result>
      </Shell>
    )
  }

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Certificate #", value: <span className="font-mono text-[13px]">{certificate.certificateNumber}</span> },
    { label: "Recipient", value: <span className="font-medium">{certificate.recipientName}</span> },
    { label: "Event", value: certificate.event.title },
    { label: "Event Date", value: <span className="tabular-nums">{certificate.event.startDate.toLocaleDateString("en-IN")}</span> },
    { label: "Type", value: <Pill tone="neutral">{statusLabel(certificate.type)}</Pill> },
    { label: "Issued", value: <span className="tabular-nums">{certificate.issuedDate.toLocaleDateString("en-IN")}</span> },
    { label: "Status", value: <Pill tone="positive">Valid</Pill> },
  ]

  return (
    <Shell>
      <Result icon={CircleCheck} tone="text-positive" title="Certificate verified" />
      <dl className="mt-8 divide-y divide-rule rounded-lg border bg-card text-sm">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 px-5 py-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Verified on EventFlow — Professional Event Management Platform</p>
    </Shell>
  )
}
