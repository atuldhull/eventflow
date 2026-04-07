import { AlertCircle, RefreshCw, Home } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ErrorFallbackProps {
  title?: string
  message?: string
  retry?: () => void
  showHome?: boolean
}

export function ErrorFallback({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  retry,
  showHome = true,
}: ErrorFallbackProps) {
  return (
    <Card className="max-w-md mx-auto p-8 text-center space-y-4" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
        <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-3 justify-center">
        {retry && (
          <Button onClick={retry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try Again
          </Button>
        )}
        {showHome && (
          <Link href="/" className={cn(buttonVariants(), "gap-2")}>
            <Home className="h-4 w-4" aria-hidden="true" /> Go Home
          </Link>
        )}
      </div>
    </Card>
  )
}
