"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/marketing/layout"

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState("")

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute top-[-160px] right-[-80px] -z-10 size-[460px] rounded-full bg-lavender/25 blur-[120px]" />
      <Container className="py-16 sm:py-28">
        <div className="max-w-[640px]">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
            Certificates
          </p>
          <h1 className="font-display mt-3 text-[38px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[60px]">
            Verify a{" "}
            <span className="relative z-0 inline-block px-[0.06em] whitespace-nowrap">
              <span aria-hidden className="absolute -inset-x-[0.04em] top-[0.1em] bottom-[0.02em] -z-10 -rotate-[1.5deg] rounded-[0.16em] bg-lemon" />
              <span className="relative text-lemon-ink">certificate</span>
            </span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">Enter the verification code from your certificate</p>

          <form
            className="mt-10 space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = code.trim()
              if (trimmed) router.push(`/verify/${encodeURIComponent(trimmed)}`)
            }}
          >
            <Label htmlFor="verify-code">Verification code</Label>
            <div className="flex flex-col gap-3 rounded-3xl border bg-card p-2 has-[input:focus-visible]:border-ring sm:flex-row sm:rounded-full">
              <Input
                id="verify-code"
                placeholder="e.g., VER-X8MN45PQ"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="h-12 border-0 bg-transparent font-mono text-[17px] tracking-wide shadow-none focus-visible:ring-0 sm:pl-5 dark:bg-transparent"
              />
              <Button
                type="submit"
                size="lg"
                className="h-12 shrink-0 gap-2 bg-lemon px-6 text-[15px] font-semibold text-lemon-ink hover:bg-lemon hover:shadow-[0_12px_40px_-10px_var(--lemon)]"
                disabled={!code.trim()}
              >
                <Search aria-hidden /> Verify certificate
              </Button>
            </div>
          </form>
        </div>
      </Container>
    </div>
  )
}
