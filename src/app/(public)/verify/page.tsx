"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Award } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState("")

  return (
    <div className="container mx-auto px-4 py-20 max-w-md text-center space-y-6">
      <Award className="mx-auto h-12 w-12 text-primary" />
      <h1 className="text-2xl font-bold">Verify a Certificate</h1>
      <p className="text-muted-foreground">Enter the verification code from your certificate</p>
      <Card className="p-6 space-y-4">
        <Input placeholder="e.g., VER-X8MN45PQ" value={code} onChange={(e) => setCode(e.target.value)} className="text-center font-mono" />
        <Button className="w-full gap-2" onClick={() => code && router.push(`/verify/${code}`)} disabled={!code.trim()}>
          <Search className="h-4 w-4" /> Verify Certificate
        </Button>
      </Card>
    </div>
  )
}
