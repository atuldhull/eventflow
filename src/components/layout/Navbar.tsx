"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOut } from "@/lib/sign-out"
import { ChevronDown, LayoutDashboard, LogOut, Menu, Shield, Ticket, Settings } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { LogoMark } from "@/components/shared/Logo"
import { cn } from "@/lib/utils"
import { isAdminRole } from "@/lib/permissions"
import type { Role } from "@/lib/constants"

const NAV_LINKS = [
  { label: "Events", href: "/events" },
  { label: "For organizers", href: "/for-organizers" },
  { label: "Pricing", href: "/pricing" },
]

/**
 * A plain bar: wordmark, three links, one action. Over the landing page's
 * navy hero it is inverted (white on navy) until the page scrolls; elsewhere
 * it is white with a hairline once content passes under it.
 */
export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // the landing hero is white now (design.pen), so the bar never inverts; kept as a flag for clarity
  const inverted = false
  const userRole = session?.user?.role as Role | undefined
  const isAdmin = userRole ? isAdminRole(userRole) : false
  const isSuperAdmin = userRole === "SUPER_ADMIN"
  const firstName = session?.user?.name?.split(" ")[0]

  return (
    <header
      className={cn(
        "pt-safe fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        inverted ? "bg-charcoal text-white" : "text-foreground",
        scrolled ? "border-border/70 bg-background/75 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="group/logo inline-flex items-center gap-2.5 rounded-md" aria-label="EventFlow home">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-lemon text-lemon-ink transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover/logo:-rotate-12 group-hover/logo:scale-110">
            <LogoMark className="size-5" />
          </span>
          <span className="font-display text-[17px] font-bold tracking-[-0.02em]">EventFlow</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm transition-colors after:absolute after:inset-x-3 after:bottom-1 after:h-[2px] after:origin-left after:scale-x-0 after:rounded-full after:bg-lavender after:transition-transform after:duration-300 hover:after:scale-x-100",
                  active && "after:scale-x-100",
                  inverted
                    ? active ? "text-white" : "text-white/75 hover:text-white"
                    : active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle className={cn(inverted && "text-white hover:bg-white/10 hover:text-white")} />
          {status === "authenticated" && session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" className={cn("gap-2 px-2", inverted && "text-white hover:bg-white/10 hover:text-white")} />}
              >
                <span className={cn("flex size-7 items-center justify-center rounded-full text-[11px] font-semibold", inverted ? "bg-white text-charcoal" : "bg-lavender text-charcoal")}>
                  {session.user.name?.[0]?.toUpperCase() || "U"}
                </span>
                <span className="max-w-28 truncate text-sm">{firstName}</span>
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{session.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/dashboard" />}><LayoutDashboard className="size-4" /> Dashboard</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dashboard/tickets" />}><Ticket className="size-4" /> My tickets</DropdownMenuItem>
                {isAdmin && <DropdownMenuItem render={<Link href="/admin" />}><Settings className="size-4" /> Admin</DropdownMenuItem>}
                {isSuperAdmin && <DropdownMenuItem render={<Link href="/super-admin" />}><Shield className="size-4" /> Platform admin</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}><LogOut className="size-4" /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : status !== "loading" ? (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), inverted && "text-white hover:bg-white/10 hover:text-white")}>
                Log in
              </Link>
              <Link href="/signup" className={cn(buttonVariants(), "rounded-full px-5 font-semibold shadow-[0_0_0_0_var(--lemon)] transition-[box-shadow,transform,background-color] hover:shadow-[0_0_28px_-4px_var(--lemon)] dark:hover:bg-lemon", inverted && "bg-white text-charcoal hover:bg-white/90")}>
                Sign up
              </Link>
            </>
          ) : null}
        </div>

        {/* phone */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle className={cn(inverted && "text-white hover:bg-white/10 hover:text-white")} />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" className={cn("size-11", inverted && "text-white hover:bg-white/10 hover:text-white")} />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="pt-safe pb-safe w-[86vw] max-w-sm gap-0 p-0">
              <div className="flex h-16 items-center gap-2 px-5">
                <LogoMark />
                <SheetTitle className="text-[15px] font-semibold">EventFlow</SheetTitle>
              </div>
              <nav className="flex flex-col px-2" aria-label="Mobile">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="press flex h-12 items-center rounded-lg px-3 text-[17px] font-medium hover:bg-accent">
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto border-t p-4">
                {session?.user ? (
                  <div className="space-y-1">
                    <div className="px-1 pb-2">
                      <p className="truncate text-sm font-medium">{session.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                    </div>
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="press flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] hover:bg-accent"><LayoutDashboard className="size-4" /> Dashboard</Link>
                    <Link href="/dashboard/tickets" onClick={() => setMobileOpen(false)} className="press flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] hover:bg-accent"><Ticket className="size-4" /> My tickets</Link>
                    {isAdmin && <Link href="/admin" onClick={() => setMobileOpen(false)} className="press flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] hover:bg-accent"><Settings className="size-4" /> Admin</Link>}
                    {isSuperAdmin && <Link href="/super-admin" onClick={() => setMobileOpen(false)} className="press flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] hover:bg-accent"><Shield className="size-4" /> Platform admin</Link>}
                    <button onClick={() => signOut({ callbackUrl: "/" })} className="press flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-destructive hover:bg-accent"><LogOut className="size-4" /> Log out</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/login" onClick={() => setMobileOpen(false)} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Log in</Link>
                    <Link href="/signup" onClick={() => setMobileOpen(false)} className={cn(buttonVariants(), "h-11")}>Sign up</Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
