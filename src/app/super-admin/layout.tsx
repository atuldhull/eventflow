import { AdminSidebar } from "@/components/layout/AdminSidebar"

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 pl-64">
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
