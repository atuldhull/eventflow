"use client"

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="skip-to-content"
      onFocus={(e) => e.currentTarget.classList.add("focused")}
      onBlur={(e) => e.currentTarget.classList.remove("focused")}
    >
      Skip to main content
    </a>
  )
}
