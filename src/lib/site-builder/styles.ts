import type { SiteStyles } from "@/types/site-builder"

/** Generate CSS custom properties string from SiteStyles */
export function generateCSSVariables(styles: SiteStyles): string {
  return `:root {
  --site-primary: ${styles.primaryColor};
  --site-secondary: ${styles.secondaryColor};
  --site-accent: ${styles.accentColor || styles.primaryColor};
  --site-bg: ${styles.backgroundColor};
  --site-text: ${styles.textColor};
  --site-font-heading: ${styles.fontHeading};
  --site-font-body: ${styles.fontBody};
  --site-border-radius: ${styles.borderRadius};
}`
}

/** Build Google Fonts URL for heading + body fonts */
export function getGoogleFontsUrl(styles: SiteStyles): string {
  const extract = (fontStr: string) => fontStr.replace(/'/g, "").split(",")[0].trim()
  const heading = extract(styles.fontHeading)
  const body = extract(styles.fontBody)
  const fonts = new Set([heading, body])
  const params = Array.from(fonts)
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join("&")
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

/** Sanitize user-provided custom CSS */
export function sanitizeCustomCss(css: string): string {
  if (!css) return ""
  let sanitized = css.slice(0, 10000)
  // Strip @import (prevent loading external resources)
  sanitized = sanitized.replace(/@import\s+[^;]+;/gi, "")
  // Strip url() with non-https sources
  sanitized = sanitized.replace(/url\s*\(\s*(?!['"]?https:)[^)]+\)/gi, "url()")
  // Strip JS expressions
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, "")
  sanitized = sanitized.replace(/behavior\s*:\s*url\([^)]*\)/gi, "")
  return sanitized
}

/** Calculate relative luminance of a hex color */
export function getRelativeLuminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g)?.map((c) => {
    const v = parseInt(c, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }) || [0, 0, 0]
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/** Calculate WCAG contrast ratio between two hex colors */
export function calculateContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1)
  const l2 = getRelativeLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Check if a color is dark (luminance < 0.5) */
export function isDarkColor(hex: string): boolean {
  return getRelativeLuminance(hex) < 0.2
}

/** Module ID → URL slug mapping for standalone pages */
export const MODULE_PAGE_SLUGS: Record<string, string[]> = {
  "live-quiz": ["quiz", "quizzes"],
  "blog-posts": ["blog", "posts", "news"],
  "photo-gallery": ["gallery", "photos"],
  "leaderboard": ["leaderboard", "rankings"],
  "merchandise-store": ["shop", "store", "merchandise"],
  "volunteer-signup": ["volunteer", "volunteers"],
  "event-calendar-widget": ["calendar"],
}

/** Find module ID from a URL slug */
export function getModuleIdFromSlug(slug: string): string | null {
  for (const [moduleId, slugs] of Object.entries(MODULE_PAGE_SLUGS)) {
    if (slugs.includes(slug)) return moduleId
  }
  return null
}
