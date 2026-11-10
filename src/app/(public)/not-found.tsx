import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/marketing/layout"
import { cn } from "@/lib/utils"

/** 404 inside the public site's navbar and footer (unknown organization, enterprise, ...). */
export default function PublicNotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <div className="max-w-[520px]">
        <p className="text-[13px] text-muted-foreground tabular-nums">404</p>
        <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">Page not found</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          This page doesn&apos;t exist, or the organization behind it is no longer on EventFlow.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/events" className={cn(buttonVariants({ size: "lg" }), "px-5")}>Browse events</Link>
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-5")}>Go home</Link>
        </div>
      </div>
    </Container>
  )
}
