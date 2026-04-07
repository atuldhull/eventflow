import { Sidebar } from "@/components/layout/Sidebar"
import { dashboardNavItems } from "@/config/navigation"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar items={dashboardNavItems} title="Dashboard" />
      <div className="flex-1">
        <header className="sticky top-0 z-40 border-b bg-background px-6 py-4">
          <h2 className="text-lg font-semibold">Dashboard</h2>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
