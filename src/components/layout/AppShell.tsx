"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useSession } from "next-auth/react"
import { signOut } from "@/lib/sign-out"
import { useTheme } from "next-themes"
import {
  Check,
  ChevronsUpDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"
import { useRBAC } from "@/hooks/useRBAC"
import { getRoleLabel } from "@/lib/permissions"
import type { Permission } from "@/lib/permissions"
import { useUIStore } from "@/stores/useUIStore"
import { useMounted } from "@/hooks/useMounted"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ContextSwitcher } from "@/components/shared/ContextSwitcher"
import { LogoMark } from "@/components/shared/Logo"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { RouteTransition } from "@/components/motion/RouteTransition"
import { JumpTo, type Workspace } from "./JumpTo"
import {
  areaForPath,
  areaLabel,
  filterNav,
  isActive,
  navByArea,
  type NavGroup,
  type NavItem,
  type ShellArea,
} from "./nav-config"

/**
 * The application frame for every signed-in area (attendee, organization,
 * enterprise, platform).
 *
 * Desktop (lg+): a navy-tinted L-frame holds the sidebar and a 48px top bar
 * with no rule between them; the page sits on a white sheet inset 8px from
 * the right and bottom edges (16px corners, 1px edge, no shadow).
 * Phone and tablet: the frame disappears, a 48px top bar names the page, and
 * a bottom tab bar carries four destinations plus More. Safe areas are padded
 * for notches, home indicators and gesture bars when installed as a PWA.
 */
export function AppShell({ children, area: areaProp }: { children: React.ReactNode; area?: ShellArea }) {
  const pathname = usePathname()
  const area = areaProp ?? areaForPath(pathname)
  const { data: session } = useSession()
  const { hasAnyPermission, hasPermission, isSuperAdmin, role } = usePermissions()
  const { permissions, accessibleOrganizations, accessibleEnterprises, isAdmin, currentOrganizationId, currentEnterpriseId, setOrganizationContext, setEnterpriseContext, enterpriseRole, organizationRole, isLoading: rbacLoading } = useRBAC()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const [moreOpen, setMoreOpen] = useState(false)
  // permissions and workspaces come from a browser-persisted store: render them only after mount
  const mounted = useMounted()

  // Same rule the /admin entry page applies: arriving straight on an org or enterprise
  // screen (bookmark, shortcut, workspace switch) selects the first one you can access.
  useEffect(() => {
    if (!mounted) return
    if (area === "org" && !currentOrganizationId && accessibleOrganizations.length > 0) setOrganizationContext(accessibleOrganizations[0].id)
    if (area === "enterprise" && !currentEnterpriseId && accessibleEnterprises.length > 0) setEnterpriseContext(accessibleEnterprises[0].id)
  }, [mounted, area, currentOrganizationId, currentEnterpriseId, accessibleOrganizations, accessibleEnterprises, setOrganizationContext, setEnterpriseContext])

  const allow = (perms: Permission[]) => area === "attendee" || area === "platform" || (mounted && (isSuperAdmin || hasAnyPermission(perms)))
  // plain computation: the React Compiler memoizes it with the right dependencies
  const groups = filterNav(navByArea[area], allow)
  const items = groups.flatMap((g) => g.items)
  const current = items.find((i) => isActive(i, pathname))
  const primary = items.filter((i) => i.primary).slice(0, 4)

  const workspaces: Workspace[] = useMemo(() => {
    const w: Workspace[] = [{ label: areaLabel.attendee, href: "/dashboard" }]
    if (!mounted) return w
    if (isSuperAdmin || isAdmin || accessibleOrganizations.length > 0) w.push({ label: areaLabel.org, href: "/admin" })
    if (isSuperAdmin || accessibleEnterprises.length > 0) w.push({ label: areaLabel.enterprise, href: "/admin/enterprise" })
    if (isSuperAdmin) w.push({ label: areaLabel.platform, href: "/super-admin" })
    return w
  }, [mounted, isSuperAdmin, isAdmin, accessibleOrganizations.length, accessibleEnterprises.length])

  const can = (p: string) => isSuperAdmin || hasPermission(p as Permission)
  const collapsed = !sidebarOpen
  const user = session?.user
  // The role in the workspace being shown: the enterprise or organization membership role
  // there; the global role only in the platform (and attendee) area
  const workspaceRole = !mounted
    ? null
    : area === "enterprise" ? enterpriseRole
      : area === "org" ? organizationRole
        : role
  const workspaceRoleLabel = workspaceRole ? getRoleLabel(workspaceRole) : mounted && !rbacLoading && (area === "enterprise" || area === "org") ? "No access here" : ""

  return (
    <div className="min-h-dvh bg-background lg:bg-frame">
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-16" : "w-(--sidebar-width)",
        )}
        aria-label="Main navigation"
      >
        <div className={cn("flex h-12 shrink-0 items-center gap-2", collapsed ? "justify-center px-2" : "px-3")}>
          {collapsed ? (
            <Link href={workspaces.find((w) => w.label === areaLabel[area])?.href ?? "/dashboard"} aria-label="EventFlow" className="text-foreground">
              <LogoMark />
            </Link>
          ) : (
            <WorkspaceMenu area={area} workspaces={workspaces} />
          )}
        </div>

        {!collapsed && (area === "org" || area === "enterprise") && (
          <div className="px-3 pb-2">
            <ContextSwitcher />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {groups.map((g, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-5")}>
              {g.label && !collapsed && <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">{g.label}</p>}
              {g.label && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink item={item} active={isActive(item, pathname)} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={cn("shrink-0 p-2", collapsed && "flex flex-col items-center gap-1")}>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={toggleSidebar}
            className={cn("text-muted-foreground", !collapsed && "w-full justify-start gap-2 px-2.5")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && "Collapse"}
          </Button>
          <AccountMenu collapsed={collapsed} name={user?.name} email={user?.email} roleLabel={workspaceRoleLabel} />
        </div>
      </aside>

      {/* ── Column beside the sidebar ──────────────────────────────── */}
      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-16" : "lg:pl-(--sidebar-width)")}>
        {/* desktop top bar, on the frame, no rule */}
        <header className="sticky top-0 z-30 hidden h-12 shrink-0 items-center gap-3 bg-frame pr-4 pl-2 lg:flex">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="truncate text-muted-foreground">{areaLabel[area]}</span>
            {current && (
              <>
                <span className="text-border">/</span>
                <span className="truncate font-medium text-foreground">{current.label}</span>
              </>
            )}
          </div>
          <JumpTo groups={groups} workspaces={workspaces} can={can} className="flex-[1.4]" />
          <div className="flex flex-1 items-center justify-end gap-1">
            <ThemeButton />
            <NotificationBell />
          </div>
        </header>

        {/* phone / tablet top bar */}
        <header className="pt-safe sticky top-0 z-30 border-b bg-background/95 lg:hidden">
          <div className="flex h-12 items-center gap-2 px-2">
            <Button variant="ghost" size="icon" onClick={() => setMoreOpen(true)} aria-label="Open menu" className="pointer-coarse:size-11">
              <Menu className="size-5" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{current?.label ?? areaLabel[area]}</h2>
            <NotificationBell />
          </div>
        </header>

        {/* the sheet */}
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "flex-1 bg-background outline-none",
            "lg:mr-(--sheet-inset) lg:mb-(--sheet-inset) lg:rounded-(--sheet-radius) lg:border lg:border-border",
            "pb-[calc(var(--bottombar-height)+env(safe-area-inset-bottom)+1rem)] lg:pb-0",
          )}
        >
          <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:py-6">
            <RouteTransition>{children}</RouteTransition>
          </div>
        </main>
      </div>

      {/* ── Phone bottom tab bar ───────────────────────────────────── */}
      <nav
        aria-label="Primary"
        data-bottombar=""
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 lg:hidden"
      >
        <ul className="mx-auto grid h-(--bottombar-height) max-w-xl grid-cols-5">
          {primary.map((item) => {
            const active = isActive(item, pathname)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {active && (
                    <motion.span layoutId="tabbar-indicator" className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                  )}
                  <item.icon className="size-5" strokeWidth={active ? 2.1 : 1.75} />
                  <span className="max-w-[72px] truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="press flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
              aria-label="More destinations"
            >
              <Menu className="size-5" strokeWidth={1.75} />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* ── More sheet (phone / tablet) ────────────────────────────── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-safe max-h-[88dvh] gap-0 overflow-y-auto rounded-t-2xl p-0">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="flex items-center gap-3 px-4 pt-3 pb-4">
            <Avatar name={user?.name} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-[15px] font-semibold">{user?.name ?? "Account"}</SheetTitle>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          {workspaces.length > 1 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3">
              {workspaces.map((w) => {
                const on = w.label === areaLabel[area]
                return (
                  <Link
                    key={w.href}
                    href={w.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", on ? "border-foreground bg-foreground text-background" : "border-border text-foreground")}
                  >
                    {w.label}
                  </Link>
                )
              })}
            </div>
          )}
          {(area === "org" || area === "enterprise") && (
            <div className="px-4 pb-3">
              <ContextSwitcher />
            </div>
          )}
          <MobileNavList groups={groups} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
          <div className="mt-2 flex items-center gap-2 border-t px-4 py-3">
            <ThemeButton withLabel />
            <Button variant="ghost" className="ml-auto gap-2 text-destructive pointer-coarse:h-11" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-full text-sm transition-colors",
        collapsed ? "justify-center px-0" : "px-2.5",
        active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {active && (
        <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-full bg-sidebar-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
      )}
      <item.icon className={cn("relative size-4 shrink-0", active ? "text-brand dark:text-lemon" : "text-muted-foreground")} strokeWidth={active ? 2 : 1.75} />
      {!collapsed && <span className={cn("relative truncate", active && "font-medium")}>{item.label}</span>}
    </Link>
  )
}

function MobileNavList({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate: () => void }) {
  return (
    <nav aria-label="All destinations" className="px-2">
      {groups.map((g, gi) => (
        <div key={gi} className={cn(gi > 0 && "mt-3")}>
          {g.label && <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{g.label}</p>}
          <ul>
            {g.items.map((item) => {
              const active = isActive(item, pathname)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn("press flex h-12 items-center gap-3 rounded-lg px-3 text-[15px]", active ? "bg-accent font-medium" : "text-foreground")}
                  >
                    <item.icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
                    {item.label}
                    {active && <Check className="ml-auto size-4 text-muted-foreground" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function WorkspaceMenu({ area, workspaces }: { area: ShellArea; workspaces: Workspace[] }) {
  const single = workspaces.length <= 1
  const inner = (
    <>
      <span className="flex size-7 -rotate-6 items-center justify-center rounded-lg bg-lemon text-lemon-ink transition-transform group-hover:rotate-0">
        <LogoMark className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-left leading-tight">
        <span className="block font-display text-[15px] font-bold tracking-[-0.02em]">EventFlow</span>
        <span className="block truncate text-xs text-muted-foreground">{areaLabel[area]}</span>
      </span>
      {!single && <ChevronsUpDown className="size-4 text-muted-foreground" />}
    </>
  )
  if (single) return <Link href="/dashboard" className="flex w-full items-center gap-2 rounded-md p-1">{inner}</Link>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex w-full items-center gap-2 rounded-lg p-1 transition-colors hover:bg-sidebar-accent/60" aria-label="Switch workspace">
        {inner}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.href} render={<Link href={w.href} />}>
            <span className="flex-1">{w.label}</span>
            {w.label === areaLabel[area] && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountMenu({ collapsed, name, email, roleLabel }: { collapsed: boolean; name?: string | null; email?: string | null; roleLabel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("mt-1 flex items-center gap-2 rounded-md text-left transition-colors hover:bg-sidebar-accent/60", collapsed ? "p-1" : "w-full p-1.5")}
        aria-label="Account menu"
      >
        <Avatar name={name} />
        {!collapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{name ?? "Account"}</span>
            <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/profile" />}><User className="size-4" /> Profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/settings" />}><Settings className="size-4" /> Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}><LogOut className="size-4" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Avatar({ name }: { name?: string | null }) {
  const initials = (name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
      {initials}
    </span>
  )
}

function ThemeButton({ withLabel }: { withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const dark = mounted && resolvedTheme === "dark"
  return (
    <Button
      variant="ghost"
      size={withLabel ? "default" : "icon"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn("text-muted-foreground", withLabel && "gap-2 pointer-coarse:h-11")}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {withLabel && (dark ? "Light theme" : "Dark theme")}
    </Button>
  )
}
