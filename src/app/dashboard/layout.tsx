"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { Calendar, Ticket, Award, CreditCard, User, Bell, Settings, LayoutDashboard, Heart } from "lucide-react"
import { RouteTransition } from "@/components/motion/RouteTransition"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Events", href: "/dashboard/events", icon: Calendar },
  { label: "My Tickets", href: "/dashboard/tickets", icon: Ticket },
  { label: "Saved Events", href: "/dashboard/saved", icon: Heart },
  { label: "Certificates", href: "/dashboard/certificates", icon: Award },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="text-lg font-bold text-sidebar-foreground">EventFlow</Link>
        </div>

        {/* User info */}
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {session?.user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">{session?.user?.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav — "layoutId" on the active pill slides it between items via
            framer's shared-layout animation. No ugly snap/jump between routes. */}
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="dashboard-active-pill"
                    className="absolute inset-0 rounded-md bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <item.icon className="relative h-4 w-4" />
                <span className="relative">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1">
        <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-6">
          <h2 className="text-sm font-semibold">My Dashboard</h2>
        </header>
        <main className="p-6">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  )
}
