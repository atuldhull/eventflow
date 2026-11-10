"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { CalendarPlus, CornerDownLeft, Search, Ticket } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { PERMISSIONS } from "@/lib/permissions"
import type { NavGroup } from "./nav-config"
import { cn } from "@/lib/utils"

export interface Workspace {
  label: string
  href: string
}

interface JumpToProps {
  groups: NavGroup[]
  workspaces: Workspace[]
  can: (p: string) => boolean
  className?: string
}

/**
 * ⌘K / Ctrl+K "Jump to". Navigation only: every entry is an existing route
 * the signed-in user is already allowed to open.
 */
export function JumpTo({ groups, workspaces, can, className }: JumpToProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  // read the platform without a setState-in-effect; the server snapshot assumes Mac (⌘)
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const actions = useMemo(() => {
    const list: { label: string; href: string; icon: typeof Search }[] = []
    if (can(PERMISSIONS.EVENT_CREATE)) list.push({ label: "Create an event", href: "/admin/org/events/create", icon: CalendarPlus })
    list.push({ label: "Browse public events", href: "/events", icon: Ticket })
    return list
  }, [can])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground",
          className,
        )}
        aria-label="Jump to a page"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Jump to…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 font-sans text-[11px] text-muted-foreground sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Jump to" description="Go to a page or run an action">
        <CommandInput placeholder="Search pages and actions" />
        <CommandList>
          <CommandEmpty>No page matches that.</CommandEmpty>
          {groups.map((g, gi) => (
            <CommandGroup key={gi} heading={g.label ?? "Pages"}>
              {g.items.map((item) => (
                <CommandItem key={item.href} value={`${g.label ?? ""} ${item.label}`} onSelect={() => go(item.href)}>
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandGroup heading="Actions">
            {actions.map((a) => (
              <CommandItem key={a.href} value={a.label} onSelect={() => go(a.href)}>
                <a.icon className="size-4 text-muted-foreground" />
                {a.label}
                <CommandShortcut><CornerDownLeft className="size-3.5" /></CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          {workspaces.length > 1 && (
            <CommandGroup heading="Switch workspace">
              {workspaces.map((w) => (
                <CommandItem key={w.href} value={`workspace ${w.label}`} onSelect={() => go(w.href)}>
                  {w.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
