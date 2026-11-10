"use client"

import { signOut as nextAuthSignOut } from "next-auth/react"
import { forgetOfflineData } from "@/lib/offline-tickets"

/**
 * Sign out and remove what this device kept for offline use (the saved tickets and the
 * signed-in pages in the service worker cache), so the next person on the device never
 * sees them. OfflineDataGuard catches sign-outs that don't go through here (expired sessions).
 */
export async function signOut(options?: Parameters<typeof nextAuthSignOut>[0]) {
  await forgetOfflineData()
  return nextAuthSignOut(options)
}
