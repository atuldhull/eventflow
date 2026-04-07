"use client"

import { use } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"

export default function EditOrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params)

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Edit Organization"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Organizations", href: "/admin/enterprise/organizations" },
          { label: "Edit" },
        ]}
      />
      <Card className="p-6">
        <p className="text-sm text-muted-foreground text-center py-8">
          Edit form will be populated when connected to the database.
        </p>
      </Card>
    </div>
  )
}
