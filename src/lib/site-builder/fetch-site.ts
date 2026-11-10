/** Fetch published site data for an org (server-side, cached 15 s so publish / unpublish / edits show up quickly) */
export async function getSiteData(orgSlug: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    const res = await fetch(`${baseUrl}/api/site/${orgSlug}`, { next: { revalidate: 15 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.exists ? json : null
  } catch {
    return null
  }
}

/** Fetch a custom page's section data (server-side, cached 15 s) */
export async function getPageData(orgSlug: string, pageSlug: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    const res = await fetch(`${baseUrl}/api/site/${orgSlug}/pages/${pageSlug}`, { next: { revalidate: 15 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.success ? json.page : null
  } catch {
    return null
  }
}
