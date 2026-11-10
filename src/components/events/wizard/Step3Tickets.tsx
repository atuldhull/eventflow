"use client"

import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { TicketsStepProps } from "./shared"
import { Field, ToggleRow, WizardSection } from "./Section"

export function Step3Tickets({
  register, watch, setValue, ticketTypes, addTicketType, removeTicketType, updateTicketType, addons, setAddons,
}: TicketsStepProps) {
  const isPaid = watch("isPaid")

  return (
    <div className="space-y-6">
      <WizardSection title="Pricing" description="Whether attendees pay for their tickets.">
        <ToggleRow label="Paid event" description="Charge for tickets" checked={watch("isPaid")} onCheckedChange={(v) => setValue("isPaid", !!v)} />
      </WizardSection>

      <WizardSection
        title="Ticket types"
        description="Each type has its own price and stock."
        action={
          <Button type="button" variant="outline" size="sm" onClick={addTicketType}>
            <Plus /> Add ticket
          </Button>
        }
      >
        <ul className="divide-y divide-rule rounded-lg border">
          {ticketTypes.map((tt, i) => (
            <li key={i} className="space-y-4 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Ticket {i + 1}</span>
                {ticketTypes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ticket ${i + 1}`}
                    onClick={() => removeTicketType(i)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`tt-name-${i}`} label="Name">
                  <Input id={`tt-name-${i}`} placeholder="General Admission" value={tt.name} onChange={(e) => updateTicketType(i, "name", e.target.value)} />
                </Field>
                <Field id={`tt-price-${i}`} label="Price (₹)" hint={!isPaid ? "Turn on Paid event to set a price." : undefined}>
                  <Input id={`tt-price-${i}`} type="number" min={0} inputMode="decimal" className="tabular-nums" value={tt.price} onChange={(e) => updateTicketType(i, "price", parseFloat(e.target.value) || 0)} disabled={!isPaid} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`tt-qty-${i}`} label="Total tickets available" hint="How many of this ticket exist in total.">
                  <Input id={`tt-qty-${i}`} type="number" min={1} inputMode="numeric" placeholder="Leave blank for unlimited" value={typeof tt.quantity === "number" ? tt.quantity : ""} onChange={(e) => updateTicketType(i, "quantity", e.target.value ? parseInt(e.target.value) : undefined)} />
                </Field>
                <Field id={`tt-max-${i}`} label="Max tickets per person" hint="Limit how many one person can buy in a single order.">
                  <Input id={`tt-max-${i}`} type="number" min={1} max={10} inputMode="numeric" value={tt.maxPerUser} onChange={(e) => updateTicketType(i, "maxPerUser", parseInt(e.target.value) || 1)} />
                </Field>
              </div>
            </li>
          ))}
        </ul>
      </WizardSection>

      <WizardSection title="Registration settings" description="Capacity and how sign-ups are accepted.">
        <Field id="ev-capacity" label="Max capacity (optional)">
          <Input id="ev-capacity" type="number" min={1} inputMode="numeric" placeholder="Leave blank for unlimited" className="sm:max-w-60" {...register("maxCapacity")} />
        </Field>
        <div className="divide-y divide-rule rounded-lg border px-4 [&>*]:py-3.5">
          <ToggleRow label="Enable waitlist" description="Allow waitlist when full" checked={watch("waitlistEnabled")} onCheckedChange={(v) => setValue("waitlistEnabled", !!v)} />
          <ToggleRow label="Require approval" description="Manually approve each registration" checked={watch("approvalRequired")} onCheckedChange={(v) => setValue("approvalRequired", !!v)} />
          <ToggleRow label="Team registration" description="Allow teams to register" checked={watch("allowTeamRegistration")} onCheckedChange={(v) => setValue("allowTeamRegistration", !!v)} />
          {watch("allowTeamRegistration") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ev-team-min" label="Min team size"><Input id="ev-team-min" type="number" min={2} inputMode="numeric" {...register("minTeamSize")} /></Field>
              <Field id="ev-team-max" label="Max team size"><Input id="ev-team-max" type="number" min={2} inputMode="numeric" {...register("maxTeamSize")} /></Field>
            </div>
          )}
        </div>
      </WizardSection>

      <WizardSection title="Access & guests" description="Who may register and whom they can bring.">
        <Field id="ev-domains" label="Allowed email domains" hint="Only users with these email domains can register. Leave blank to allow all.">
          <Input id="ev-domains" placeholder="e.g., technova.com, company.org (comma-separated, leave blank for any)" {...register("allowedEmailDomains")} />
        </Field>
        <Field id="ev-guests" label="Max guests per registration" hint="Allow registrants to bring additional guests (e.g., family members for annual day). 0 = no guests.">
          <Input id="ev-guests" type="number" min={0} max={10} inputMode="numeric" placeholder="0 (no guests allowed)" className="sm:max-w-60" {...register("maxGuestsPerRegistration")} />
        </Field>
      </WizardSection>

      <WizardSection title="Budget tracking" description="Track event budget for internal reporting. This is not visible to participants.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ev-budget" label="Event budget (₹)">
            <Input id="ev-budget" type="number" inputMode="decimal" placeholder="e.g., 500000" className="tabular-nums" {...register("budgetAmount")} />
          </Field>
          <Field id="ev-budget-notes" label="Budget notes">
            <Input id="ev-budget-notes" placeholder="e.g., Approved by CFO on March 1" {...register("budgetNotes")} />
          </Field>
        </div>
      </WizardSection>

      <WizardSection
        title="Ticket add-ons"
        description="Optional extras participants can purchase with their ticket (meals, parking, merchandise)"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setAddons([...addons, { name: "", price: 0, category: "Food", maxQuantity: 1 }])}>
            <Plus /> Add item
          </Button>
        }
      >
        {addons.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No add-ons.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-lg border">
            {addons.map((addon, i) => (
              <li key={i} className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Add-on {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Remove add-on ${i + 1}`} onClick={() => setAddons(addons.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Input aria-label="Add-on name" placeholder="Name (e.g., Lunch)" value={addon.name} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], name: e.target.value }; setAddons(u) }} />
                  <Input aria-label="Add-on price" type="number" inputMode="decimal" placeholder="Price (₹)" value={addon.price || ""} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], price: parseFloat(e.target.value) || 0 }; setAddons(u) }} />
                  <Input aria-label="Add-on category" placeholder="Category" value={addon.category} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], category: e.target.value }; setAddons(u) }} />
                  <Input aria-label="Add-on max quantity" type="number" inputMode="numeric" placeholder="Max qty" value={addon.maxQuantity || ""} onChange={(e) => { const u = [...addons]; u[i] = { ...u[i], maxQuantity: parseInt(e.target.value) || 0 }; setAddons(u) }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </WizardSection>

      {isPaid && (
        <WizardSection title="Dynamic pricing" description="Ticket price increases automatically as event fills up">
          <ToggleRow label="Enable dynamic pricing" checked={watch("enableDynamicPricing")} onCheckedChange={(v) => setValue("enableDynamicPricing", !!v)} />
          {watch("enableDynamicPricing") && (
            <div className="space-y-1.5">
              <Label htmlFor="ev-tiers">Price tiers (JSON)</Label>
              <Textarea id="ev-tiers" rows={5} className="font-mono text-[13px] md:text-[13px]" placeholder={'[\n  { "fillPercent": 50, "priceMultiplier": 1.2 },\n  { "fillPercent": 80, "priceMultiplier": 1.5 },\n  { "fillPercent": 95, "priceMultiplier": 2.0 }\n]'} {...register("dynamicPricingTiers")} />
              <p className="text-xs text-muted-foreground">When event is 50% full, prices increase by 1.2x. At 80%, 1.5x. At 95%, 2x.</p>
            </div>
          )}
        </WizardSection>
      )}
    </div>
  )
}
