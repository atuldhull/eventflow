import Link from "next/link"
import { ClipboardList, ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function EventRegistrationsPage() {
  return (
    <div className="max-w-lg mx-auto py-12">
      <Card className="p-8 text-center">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold">Event Registrations</h2>
        <p className="text-sm text-muted-foreground mt-1">Event-specific registrations will be available in the next update.</p>
        <Link href="/admin/org/events" className={cn(buttonVariants({ variant: "outline" }), "mt-4 gap-2")}>
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Link>
      </Card>
    </div>
  )
}
