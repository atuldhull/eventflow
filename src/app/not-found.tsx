import Link from "next/link"
import { LogoMark } from "@/components/shared/Logo"
import { Container } from "@/components/marketing/layout"
import { NotFoundView } from "./_system/NotFoundView"

/** 404 for any unknown URL. No site chrome around it here, so it brings a slim header of its own. */
export default function NotFound() {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col overflow-x-clip">
      <header>
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md text-foreground" aria-label="EventFlow home">
            <span className="flex size-8 items-center justify-center rounded-lg bg-lemon text-lemon-ink">
              <LogoMark className="size-5" />
            </span>
            <span className="font-display text-[18px] font-bold tracking-[-0.03em]">EventFlow</span>
          </Link>
          <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
        </Container>
      </header>
      <main className="flex flex-1 items-center">
        <NotFoundView message="The page you're looking for doesn't exist or has been moved." />
      </main>
    </div>
  )
}
