"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { isDarkColor } from "@/lib/site-builder/styles"
import type { SiteStyles, NavItem } from "@/types/site-builder"

interface SiteNavbarProps {
  siteName: string
  logo?: string | null
  navigation: NavItem[]
  styles: SiteStyles
}

export function SiteNavbar({ siteName, logo, navigation, styles }: SiteNavbarProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)
  const isTransparent = styles.navStyle === "transparent"
  const isGlass = styles.navStyle === "glass"
  const isDark = isDarkColor(styles.backgroundColor)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  // Close the mobile menu on navigation, including back/forward.
  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    setMenuOpen(false)
  }

  const showSolid = !isTransparent || scrolled
  const textColor = isTransparent && !scrolled ? (isDark ? "#F5F5F5" : "#1E293B") : styles.textColor

  const bgStyle: React.CSSProperties = isGlass
    ? { backgroundColor: `${styles.backgroundColor}CC`, backdropFilter: "blur(12px)" }
    : showSolid
    ? { backgroundColor: styles.backgroundColor, borderBottom: "1px solid rgba(128,128,128,0.15)" }
    : { backgroundColor: "transparent" }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault()
      const el = document.querySelector(href) || document.getElementById(href.slice(1))
      el?.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-300" style={{ ...bgStyle, color: textColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo / Site name */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {logo && <img src={logo} alt={siteName} className="h-8 w-auto" />}
            <span className="font-bold text-lg" style={{ fontFamily: styles.fontHeading }}>{siteName}</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navigation.map((item, i) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.replace("#", "/"))
              return (
                <Link key={i} href={item.href} onClick={(e) => handleClick(e, item.href)}
                  target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}
                  className="text-sm font-medium transition-colors hover:opacity-80"
                  style={{ opacity: isActive ? 1 : 0.7 }}>
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 shadow-xl flex flex-col"
            style={{ backgroundColor: styles.backgroundColor, color: styles.textColor }}>
            <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
              <span className="font-bold" style={{ fontFamily: styles.fontHeading }}>{siteName}</span>
              <button onClick={() => setMenuOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {navigation.map((item, i) => (
                <Link key={i} href={item.href} onClick={(e) => { handleClick(e, item.href); setMenuOpen(false) }}
                  className="block px-3 py-3 rounded-lg text-sm font-medium transition-colors hover:opacity-80">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacer for fixed nav */}
      <div className="h-16" />
    </>
  )
}
