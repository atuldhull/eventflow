"use client"

import type { ComponentProps } from "react"
import { OTPInput } from "@/components/forms/OTPInput"

/**
 * The shared six-digit OTPInput, dressed for the auth pages: bigger rounded boxes in
 * the display face, set as two groups of three, with a lavender lift on the box in focus.
 * Purely visual: every prop goes straight through, so the input's behaviour is untouched.
 */
export function CodeBoxes(props: ComponentProps<typeof OTPInput>) {
  return (
    <div
      className={[
        "[&>div]:justify-start [&>div]:gap-2 sm:[&>div]:gap-2.5",
        "[&_input]:h-14 [&_input]:max-w-14 [&_input]:flex-1 [&_input]:rounded-xl [&_input]:bg-card! sm:[&_input]:h-16 sm:[&_input]:max-w-[60px]",
        "[&_input]:font-display [&_input]:text-[26px] [&_input]:font-bold [&_input]:tracking-normal",
        "[&_input]:transition-[transform,border-color,box-shadow] [&_input]:duration-200",
        "[&_input:focus-visible]:-translate-y-0.5 [&_input:focus-visible]:border-brand [&_input:focus-visible]:ring-brand/25",
        "[&_input:nth-child(3)]:mr-2.5 sm:[&_input:nth-child(3)]:mr-4",
      ].join(" ")}
    >
      <OTPInput {...props} />
    </div>
  )
}
