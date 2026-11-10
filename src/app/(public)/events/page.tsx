import type { Metadata } from "next"
import { EventsBrowser } from "./EventsBrowser"

export const metadata: Metadata = {
  title: "Events",
  description: "Browse workshops, hackathons, conferences, fests and more on EventFlow, and register in a minute.",
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

/**
 * The public event list: upcoming events by default, past ones with ?when=past. Filters
 * come from the URL (?category=, ?search=, ?pricing=, ?when=), so
 * the landing page's category links and shared links open the right view.
 */
export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const category = first(params.category).slice(0, 60)
  const search = first(params.search).slice(0, 100)
  const pricing = first(params.pricing)
  const when = first(params.when) === "past" ? "past" : ""
  return (
    // A link to /events with other filters (not the page's own address-bar updates) starts fresh
    <EventsBrowser key={`${category}|${search}|${pricing}|${when}`} initialCategory={category} initialSearch={search} initialPricing={pricing} initialWhen={when} />
  )
}
