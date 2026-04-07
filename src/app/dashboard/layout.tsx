"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Calendar, Ticket, Award, CreditCard, User, Bell, Settings, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Events", href: "/dashboard/events", icon: Calendar },
  { label: "My Tickets", href: "/dashboard/tickets", icon: Ticket },
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

        {/* Nav */}
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
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
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
