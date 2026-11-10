import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, CircleCheck, CircleX, CircleHelp, Clock, type LucideIcon } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { Container } from "@/components/marketing/layout"
import { statusLabel } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import prisma from "@/lib/prisma"
import { VERIFICATION_CODE_PATTERN, certificateVerificationState, revokedAt } from "@/lib/certificate-verification"

export const metadata: Metadata = { title: "Verify certificate", robots: "noindex" }

type Verdict = "valid" | "revoked" | "pending" | "missing"

const VERDICT_CLASS: Record<Verdict, string> = {
  valid: "border-transparent bg-lemon text-lemon-ink",
  revoked: "border-destructive/50 bg-pill-negative text-pill-negative-foreground",
  pending: "border-transparent bg-pill-warning text-pill-warning-foreground",
  missing: "border-dashed bg-card text-foreground",
}

/** The result: one big panel in the verdict's colour, a rubber stamp, the title and a line of explanation. */
function Result({ icon: Icon, verdict, stamp, title, children }: { icon: LucideIcon; verdict: Verdict; stamp: string; title: string; children?: React.ReactNode }) {
  return (
    <section className={cn("relative overflow-hidden rounded-[28px] border p-6 sm:p-10", VERDICT_CLASS[verdict])}>
      <div
        aria-hidden
        className="absolute top-7 right-7 hidden size-[128px] -rotate-12 items-center justify-center rounded-full border-[3px] border-current opacity-80 sm:flex"
      >
        <span className="font-display rounded-full border-y-2 border-current px-2 py-1 text-[15px] font-extrabold tracking-[0.14em] uppercase">{stamp}</span>
      </div>
      <Icon className="size-10" strokeWidth={1.75} aria-hidden />
      <h1 className="font-display mt-5 max-w-[14ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[52px]">{title}</h1>
      {children}
    </section>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
      <Container className="py-14 sm:py-24">
        <div className="max-w-[720px]">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-brand">
            <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
            Certificate check
          </p>
          {children}
          <Link
            href="/verify"
            className="mt-10 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors hover:border-lavender hover:bg-lavender/10"
          >
            <ArrowLeft className="size-4" aria-hidden /> Check another code
          </Link>
        </div>
      </Container>
    </div>
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
        <Result icon={CircleHelp} verdict="missing" stamp="No match" title="Certificate not found">
          <p className="mt-4 max-w-[48ch] text-[17px] leading-relaxed text-muted-foreground">The verification code doesn&apos;t match any certificate in our system.</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Code checked: <span className="font-mono break-all text-foreground">{code}</span>
          </p>
        </Result>
      </Shell>
    )
  }

  const state = certificateVerificationState(certificate.status, certificate.metadata)
  const certNumber = (
    <p className="mt-4 text-sm opacity-85">
      Certificate #: <span className="font-mono font-medium">{certificate.certificateNumber}</span>
    </p>
  )

  if (state === "not_issued") {
    return (
      <Shell>
        <Result icon={Clock} verdict="pending" stamp="Not issued" title="Not issued yet">
          <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed">
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
        <Result icon={CircleX} verdict="revoked" stamp="Revoked" title="Certificate revoked">
          <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed">
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
      <Result icon={CircleCheck} verdict="valid" stamp="Verified" title="Certificate verified">
        <p className="mt-4 text-[13px] font-semibold tracking-[0.1em] uppercase opacity-75">Awarded to</p>
        <p className="font-display mt-1 text-[26px] leading-tight font-bold tracking-[-0.03em] sm:text-[32px]">{certificate.recipientName}</p>
      </Result>
      <dl className="mt-5 divide-y divide-dashed divide-border overflow-hidden rounded-3xl border bg-card text-sm">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 px-6 py-3.5 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Verified on EventFlow · Professional event management platform</p>
    </Shell>
  )
}
