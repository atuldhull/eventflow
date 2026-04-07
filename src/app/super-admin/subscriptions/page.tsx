import { CreditCard } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const plans = [
  { name: "Free", price: "₹0", color: "border-zinc-200", subscribers: 0, features: ["5 events/month", "100 participants/event", "Basic analytics"] },
  { name: "Starter", price: "₹999", color: "border-blue-200", subscribers: 0, features: ["25 events/month", "500 participants/event", "Email support", "Custom branding"] },
  { name: "Pro", price: "₹2,999", color: "border-purple-200", subscribers: 0, features: ["Unlimited events", "2000 participants/event", "Priority support", "Advanced analytics", "API access"] },
  { name: "Enterprise", price: "Custom", color: "border-amber-200", subscribers: 0, features: ["Everything in Pro", "Unlimited participants", "White-label", "Custom domain", "Dedicated support"] },
]

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Manage subscription plans and active subscriptions"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Subscriptions" },
        ]}
      />

      <div>
        <h3 className="text-lg font-semibold mb-4">Plan Configuration</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.name} className={`p-6 border-2 ${plan.color}`}>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">{plan.name}</h4>
                  <p className="text-2xl font-bold mt-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">{plan.subscribers} subscribers</span>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Active Subscriptions</h3>
        <Card className="p-8 text-center text-muted-foreground">
          <CreditCard className="mx-auto h-10 w-10 mb-2 opacity-30" />
          <p className="font-medium">No active subscriptions</p>
          <p className="text-sm">Subscriptions will appear here when enterprises subscribe to paid plans.</p>
        </Card>
      </div>
    </div>
  )
}
