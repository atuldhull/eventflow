import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { RouteTransition } from "@/components/motion/RouteTransition"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 pl-64">
        <main className="p-6">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  )
}
