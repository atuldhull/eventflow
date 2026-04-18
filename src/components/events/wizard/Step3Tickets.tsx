"use client"

import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { TicketsStepProps } from "./shared"

export function Step3Tickets({
  register, watch, setValue, ticketTypes, addTicketType, removeTicketType, updateTicketType, addons, setAddons,
}: TicketsStepProps) {
  const isPaid = watch("isPaid")

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Pricing</h3>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium">Paid Event</p><p className="text-xs text-muted-foreground">Charge for tickets</p></div>
          <Switch checked={watch("isPaid")} onCheckedChange={(v) => setValue("isPaid", !!v)} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Ticket Types</h3>
          <Button type="button" variant="outline" size="sm" onClick={addTicketType} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add Ticket
          </Button>
        </div>
        {ticketTypes.map((tt, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ticket {i + 1}</span>
              {ticketTypes.length > 1 && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTicketType(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input placeholder="General Admission" value={tt.name} onChange={(e) => updateTicketType(i, "name", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Price (&#8377;)</Label><Input type="number" min={0} value={tt.price} onChange={(e) => updateTicketType(i, "price", parseFloat(e.target.value) || 0)} disabled={!isPaid} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Total Tickets Available</Label>
                <Input type="number" min={1} placeholder="Leave blank for unlimited" value={typeof tt.quantity === "number" ? tt.quantity : ""} onChange={(e) => updateTicketType(i, "quantity", e.target.value ? parseInt(e.target.value) : undefined)} />
                <p className="text-[11px] text-muted-foreground">How many of this ticket exist in total.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Tickets Per Person</Label>
                <Input type="number" min={1} max={10} value={tt.maxPerUser} onChange={(e) => updateTicketType(i, "maxPerUser", parseInt(e.target.value) || 1)} />
                <p className="text-[11px] text-muted-foreground">Limit how many one person can buy in a single order.</p>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Registration Settings</h3>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Max Capacity (optional)</Label><Input type="number" min={1} placeholder="Leave blank for unlimited" {...register("maxCapacity")} /></div>
          <div className="flex items-center justify-between"><div><p className="text-sm">Enable Waitlist</p><p className="text-xs text-muted-foreground">Allow waitlist when full</p></div><Switch checked={watch("waitlistEnabled")} onCheckedChange={(v) => setValue("waitlistEnabled", !!v)} /></div>
          <div className="flex items-center justify-between"><div><p className="text-sm">Require Approval</p><p className="text-xs text-muted-foreground">Manually approve each registration</p></div><Switch checked={watch("approvalRequired")} onCheckedChange={(v) => setValue("approvalRequired", !!v)} /></div>
          <div className="flex items-center justify-between"><div><p className="text-sm">Team Registration</p><p className="text-xs text-muted-foreground">Allow teams to register</p></div><Switch checked={watch("allowTeamRegistration")} onCheckedChange={(v) => setValue("allowTeamRegistration", !!v)} /></div>
          {watch("allowTeamRegistration") && (
            <div className="grid gap-3 sm:grid-cols-2 pl-4">
              <div className="space-y-1"><Label className="text-xs">Min Team Size</Label><Input type="number" min={2} {...register("minTeamSize")} /></div>
              <div className="space-y-1"><Label className="text-xs">Max Team Size</Label><Input type="number" min={2} {...register("maxTeamSize")} /></div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Access & Guest Settings</h3>
        <div className="space-y-2">
          <Label>Allowed Email Domains</Label>
          <Input placeholder="e.g., technova.com, company.org (comma-separated, leave blank for any)" {...register("allowedEmailDomains")} />
          <p className="text-xs text-muted-foreground">Only users with these email domains can register. Leave blank to allow all.</p>
        </div>
        <div className="space-y-2">
          <Label>Max Guests per Registration</Label>
          <Input type="number" min={0} max={10} placeholder="0 (no guests allowed)" {...register("maxGuestsPerRegistration")} />
          <p className="text-xs text-muted-foreground">Allow registrants to bring additional guests (e.g., family members for annual day). 0 = no guests.</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Budget Tracking</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Event Budget (&#8377;)</Label>
            <Input type="number" placeholder="e.g., 500000" {...register("budgetAmount")} />
          </div>
          <div className="space-y-2">
            <Label>Budget Notes</Label>
            <Input placeholder="e.g., Approved by CFO on March 1" {...register("budgetNotes")} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Track event budget for internal reporting. This is not visible to participants.</p>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Ticket Add-ons</h3>
        <p className="text-xs text-muted-foreground">Optional extras participants can purchase with their ticket (meals, parking, merchandise)</p>
        {addons.map((addon, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Add-on {i + 1}</Label>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAddons(addons.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input placeholder="Name (e.g., Lunch)" value={addon.name} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], name: e.target.value }; setAddons(u) }} />
              <Input type="number" placeholder="Price (&#8377;)" value={addon.price || ""} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], price: parseFloat(e.target.value) || 0 }; setAddons(u) }} />
              <Input placeholder="Category" value={addon.category} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], category: e.target.value }; setAddons(u) }} />
              <Input type="number" placeholder="Max qty" value={addon.maxQuantity || ""} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], maxQuantity: parseInt(e.target.value) || 0 }; setAddons(u) }} />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setAddons([...addons, { name: "", price: 0, category: "Food", maxQuantity: 1 }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Item</Button>
      </Card>

      {isPaid && (
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-medium">Dynamic Pricing</h3>
          <div className="flex items-center justify-between">
            <div><p className="text-sm">Enable Dynamic Pricing</p><p className="text-xs text-muted-foreground">Ticket price increases automatically as event fills up</p></div>
            <Switch checked={watch("enableDynamicPricing")} onCheckedChange={(v) => setValue("enableDynamicPricing", !!v)} />
          </div>
          {watch("enableDynamicPricing") && (
            <div className="space-y-2">
              <Label>Price Tiers (JSON)</Label>
              <Textarea rows={3} placeholder={'[\n  { "fillPercent": 50, "priceMultiplier": 1.2 },\n  { "fillPercent": 80, "priceMultiplier": 1.5 },\n  { "fillPercent": 95, "priceMultiplier": 2.0 }\n]'} {...register("dynamicPricingTiers")} />
              <p className="text-xs text-muted-foreground">When event is 50% full, prices increase by 1.2x. At 80%, 1.5x. At 95%, 2x.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
