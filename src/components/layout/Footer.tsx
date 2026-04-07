import Link from "next/link"
import { ThemeToggle } from "@/components/shared/ThemeToggle"

const PLATFORM_LINKS = [
  { label: "Browse Events", href: "/events" },
  { label: "For Organizers", href: "/for-organizers" },
  { label: "Pricing", href: "/pricing" },
]

const RESOURCE_LINKS = [
  { label: "Help Center", href: "/help" },
  { label: "Contact Us", href: "/contact" },
]

const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
]

export function Footer() {
  return (
    <footer className="border-t bg-zinc-950 text-zinc-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-lg font-bold text-white">EventFlow</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Professional event management platform for universities, companies, and organizations.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Platform</h4>
            <ul className="space-y-2">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-zinc-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
            <ul className="space-y-2">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-zinc-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-zinc-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800 pt-6">
          <p className="text-xs text-zinc-500">
            &copy; {new Date().getFullYear()} EventFlow. All rights reserved.
          </p>
          <p className="text-xs text-zinc-500">Made with ♥ in India</p>
        </div>
      </div>
    </footer>
  )
}
