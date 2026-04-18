"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Menu, Search, X, ChevronDown, LogOut, LayoutDashboard, Shield, Ticket, Settings, User } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { cn } from "@/lib/utils"
import { isAdminRole } from "@/lib/permissions"
import type { Role } from "@/lib/constants"

const NAV_LINKS = [
  { label: "Events", href: "/events" },
  { label: "For Organizers", href: "/for-organizers" },
  { label: "Pricing", href: "/pricing" },
]

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isLanding = pathname === "/"
  const isTransparent = isLanding && !scrolled

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const userRole = session?.user?.role as Role | undefined
  const isAdmin = userRole ? isAdminRole(userRole) : false
  const isSuperAdmin = userRole === "SUPER_ADMIN"

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        isTransparent
          ? "bg-transparent"
          : "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm supports-backdrop-filter:bg-background/60"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className={cn("text-xl font-bold", isTransparent ? "text-white" : "text-foreground")}>
          EventFlow
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                pathname === link.href
                  ? isTransparent ? "text-white" : "text-foreground"
                  : isTransparent ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {status === "authenticated" && session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant={isTransparent ? "ghost" : "outline"} size="sm" className={cn("gap-2", isTransparent && "text-white border-white/30 hover:bg-white/10")} />
                }
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {session.user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="max-w-25 truncate">{session.user.name}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Link href="/dashboard" className="flex items-center gap-2 w-full"><LayoutDashboard className="h-4 w-4" /> Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem><Link href="/dashboard/tickets" className="flex items-center gap-2 w-full"><Ticket className="h-4 w-4" /> My Tickets</Link></DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem><Link href="/admin" className="flex items-center gap-2 w-full"><Settings className="h-4 w-4" /> Admin Panel</Link></DropdownMenuItem>
                  </>
                )}
                {isSuperAdmin && (
                  <DropdownMenuItem><Link href="/super-admin" className="flex items-center gap-2 w-full"><Shield className="h-4 w-4" /> Super Admin</Link></DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : status !== "loading" ? (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), isTransparent && "text-white hover:bg-white/10")}>
                Log In
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
                Sign Up
              </Link>
            </>
          ) : null}
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className={cn(isTransparent && "text-white")} />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <p className="font-bold text-lg">EventFlow</p>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="p-4 border-t space-y-2">
                  {session?.user ? (
                    <>
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium">{session.user.name}</p>
                        <p className="text-xs text-muted-foreground">{session.user.email}</p>
                      </div>
                      <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </Link>
                      <Link href="/dashboard/tickets" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                        <Ticket className="h-4 w-4" /> My Tickets
                      </Link>
                      <Link href="/dashboard/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                        <User className="h-4 w-4" /> Profile
                      </Link>
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                          <Settings className="h-4 w-4" /> Admin Panel
                        </Link>
                      )}
                      {isSuperAdmin && (
                        <Link href="/super-admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                          <Shield className="h-4 w-4" /> Super Admin
                        </Link>
                      )}
                      <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-2 w-full text-left rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent">
                        <LogOut className="h-4 w-4" /> Log Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setMobileOpen(false)} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Log In</Link>
                      <Link href="/signup" onClick={() => setMobileOpen(false)} className={cn(buttonVariants(), "w-full")}>Sign Up</Link>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
