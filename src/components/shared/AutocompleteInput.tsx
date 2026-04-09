"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  searchFn: (query: string) => string[]
  placeholder?: string
  className?: string
  id?: string
}

export function AutocompleteInput({ value, onChange, searchFn, placeholder, className, id }: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const results = searchFn(value)
    setSuggestions(results)
    setShowDropdown(results.length > 0 && value.length >= 2)
    setActiveIdx(-1)
  }, [value, searchFn])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault()
      onChange(suggestions[activeIdx])
      setShowDropdown(false)
    } else if (e.key === "Escape") {
      setShowDropdown(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0 && value.length >= 2) setShowDropdown(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto" role="listbox">
          {suggestions.map((item, idx) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={idx === activeIdx}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                idx === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => { onChange(item); setShowDropdown(false) }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
