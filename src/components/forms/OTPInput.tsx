"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

interface OTPInputProps {
  length?: number
  onComplete: (code: string) => void
  disabled?: boolean
  error?: boolean
}

export function OTPInput({ length = 6, onComplete, disabled = false, error = false }: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const focusInput = useCallback(
    (index: number) => {
      if (index >= 0 && index < length) {
        inputRefs.current[index]?.focus()
      }
    },
    [length]
  )

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (disabled) return

      const digit = value.replace(/\D/g, "").slice(-1)
      const newValues = [...values]
      newValues[index] = digit
      setValues(newValues)

      if (digit && index < length - 1) {
        focusInput(index + 1)
      }

      const code = newValues.join("")
      if (code.length === length && newValues.every((v) => v !== "")) {
        onComplete(code)
      }
    },
    [disabled, values, length, focusInput, onComplete]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return

      if (e.key === "Backspace") {
        if (values[index]) {
          const newValues = [...values]
          newValues[index] = ""
          setValues(newValues)
        } else if (index > 0) {
          focusInput(index - 1)
          const newValues = [...values]
          newValues[index - 1] = ""
          setValues(newValues)
        }
        e.preventDefault()
      } else if (e.key === "ArrowLeft") {
        focusInput(index - 1)
      } else if (e.key === "ArrowRight") {
        focusInput(index + 1)
      }
    },
    [disabled, values, focusInput]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return
      e.preventDefault()

      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
      if (!pasted) return

      const newValues = Array(length).fill("")
      for (let i = 0; i < pasted.length; i++) {
        newValues[i] = pasted[i]
      }
      setValues(newValues)

      if (pasted.length === length) {
        onComplete(pasted)
      } else {
        focusInput(pasted.length)
      }
    },
    [disabled, length, focusInput, onComplete]
  )

  useEffect(() => {
    focusInput(0)
  }, [focusInput])

  return (
    <div className="flex items-center justify-between gap-2 sm:justify-start">
      {values.map((value, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={error || undefined}
          className={cn(
            "h-12 w-full max-w-12 min-w-0 rounded-md border bg-background text-center font-mono text-xl font-medium tabular-nums transition-colors outline-none dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25" : "border-input",
            value && !error && "border-foreground/40",
            "sm:h-14 sm:w-12"
          )}
        />
      ))}
    </div>
  )
}
