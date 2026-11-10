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
    <Container className="py-16 sm:py-24">
      <div className="max-w-[520px]">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">Verify a certificate</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">Enter the verification code from your certificate</p>

        <form
          className="mt-10 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = code.trim()
            if (trimmed) router.push(`/verify/${encodeURIComponent(trimmed)}`)
          }}
        >
          <Label htmlFor="verify-code">Verification code</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="verify-code"
              placeholder="e.g., VER-X8MN45PQ"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono sm:h-10"
            />
            <Button type="submit" size="lg" className="shrink-0 px-5" disabled={!code.trim()}>
              <Search aria-hidden /> Verify certificate
            </Button>
          </div>
        </form>
      </div>
    </Container>
  )
}
