"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Toasts float, so they are the one place a real shadow belongs. On a phone
 * they sit above the bottom tab bar and the home indicator; on desktop they
 * stack bottom-right. Status is carried by the icon colour, not a stripe.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      duration={4000}
      // A page with a sticky action bar (the event wizard) sets --toast-offset-bottom so
      // toasts clear its buttons.
      offset={{ top: 16, right: 16, left: 16, bottom: "var(--toast-offset-bottom, 16px)" }}
      mobileOffset={{ bottom: "var(--toast-bottom, 16px)", left: 12, right: 12 }}
      icons={{
        success: <CircleCheckIcon className="size-4 text-positive" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "10px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !font-sans !text-sm",
          description: "!text-muted-foreground",
        },
        style: {
          padding: "12px 14px",
          gap: "10px",
          boxShadow: "var(--shadow-float)",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
