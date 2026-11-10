import { useSyncExternalStore } from "react"

const noopSubscribe = () => () => {}

/**
 * true after hydration on the client, false on the server and during hydration —
 * for UI that depends on browser-only state (theme, platform). Uses
 * useSyncExternalStore instead of a setState-in-effect, so React knows the
 * server and client snapshots differ and there's no extra cascading render.
 */
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}
