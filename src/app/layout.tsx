import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "./providers"
import { PWARegister } from "@/components/PWARegister"
import { SmoothScrollProvider } from "@/components/motion/SmoothScrollProvider"
import { AnimatedBackground } from "@/components/motion/AnimatedBackground"
import { CustomCursor } from "@/components/motion/CustomCursor"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: {
    default: "EventFlow - Event Management Platform",
    template: "%s | EventFlow",
  },
  description: "Professional event management platform for universities, colleges, and enterprises",
  openGraph: {
    title: "EventFlow",
    description: "Professional event management platform for universities, colleges, and enterprises",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "EventFlow",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EventFlow" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SmoothScrollProvider>
            <AnimatedBackground intensity="ambient" theme="indigo" />
            <CustomCursor />
            <Providers>
              {children}
              <Toaster />
              <PWARegister />
            </Providers>
          </SmoothScrollProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
