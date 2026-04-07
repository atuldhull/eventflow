import Link from "next/link"
import { Search, Home, Calendar } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="text-7xl font-bold text-muted-foreground/20">404</div>
        <h1 className="text-2xl font-bold">Page Not Found</h1>
        <p className="text-muted-foreground text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/" className={cn(buttonVariants(), "gap-2")}>
            <Home className="h-4 w-4" /> Go Home
          </Link>
          <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <Calendar className="h-4 w-4" /> Browse Events
          </Link>
        </div>
      </Card>
    </div>
  )
}
