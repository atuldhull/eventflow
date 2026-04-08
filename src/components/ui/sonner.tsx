"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      duration={4000}
      icons={{
        success: <CircleCheckIcon className="size-4 text-green-500" />,
        info: <InfoIcon className="size-4 text-blue-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-red-500" />,
        loading: <Loader2Icon className="size-4 animate-spin text-primary" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) * 1.5)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast glass",
          success: "border-l-2 !border-l-green-500",
          error: "border-l-2 !border-l-red-500",
          info: "border-l-2 !border-l-blue-500",
          warning: "border-l-2 !border-l-amber-500",
        },
        style: {
          padding: "16px",
          gap: "8px",
          boxShadow: "0 10px 40px -10px rgb(0 0 0 / 0.15)",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
