import { AppShell } from "@/components/layout/AppShell"

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="platform">{children}</AppShell>
}
