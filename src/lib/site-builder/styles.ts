import postcss, { type AtRule, type Declaration } from "postcss"
import type { SiteStyles } from "@/types/site-builder"

// ─── Value validators (defense against breaking out of <style>) ─────────────

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNC_COLOR = /^(rgba?|hsla?|oklch|color|color-mix)\([^;{}()<>]{0,200}\)$/i
const NAMED_COLOR = /^[a-z]{3,32}$/i
const LENGTH_VALUE = /^-?(\d+\.?\d*|\.\d+)(px|rem|em|%|vw|vh|ch|fr)?$/
const SAFE_FONT_NAME = /^[A-Za-z0-9\s-]{1,40}$/

function sanitizeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const v = value.trim()
  if (HEX_COLOR.test(v) || FUNC_COLOR.test(v) || NAMED_COLOR.test(v)) return v
  return fallback
}

function sanitizeLength(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const v = value.trim()
  if (LENGTH_VALUE.test(v)) return v
  return fallback
}

/** Sanitize a font stack value like "Inter, sans-serif" into a safe quoted list. */
function sanitizeFontStack(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const parts = value.split(",").map((p) => p.replace(/["']/g, "").trim())
  const safe: string[] = []
  for (const part of parts) {
    if (!part) continue
    if (SAFE_FONT_NAME.test(part)) {
      safe.push(part.includes(" ") ? `"${part}"` : part)
    }
  }
  return safe.length > 0 ? safe.join(", ") : fallback
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Generate CSS custom properties string from SiteStyles — all values are validated. */
export function generateCSSVariables(styles: SiteStyles): string {
  const primary = sanitizeColor(styles.primaryColor, "#3b82f6")
  const secondary = sanitizeColor(styles.secondaryColor, "#64748b")
  const accent = sanitizeColor(styles.accentColor || styles.primaryColor, primary)
  const bg = sanitizeColor(styles.backgroundColor, "#ffffff")
  const text = sanitizeColor(styles.textColor, "#0f172a")
  const fontHeading = sanitizeFontStack(styles.fontHeading, "Inter, sans-serif")
  const fontBody = sanitizeFontStack(styles.fontBody, "Inter, sans-serif")
  const borderRadius = sanitizeLength(styles.borderRadius, "0.5rem")

  return `:root {
  --site-primary: ${primary};
  --site-secondary: ${secondary};
  --site-accent: ${accent};
  --site-bg: ${bg};
  --site-text: ${text};
  --site-font-heading: ${fontHeading};
  --site-font-body: ${fontBody};
  --site-border-radius: ${borderRadius};
}`
}

/** Build Google Fonts URL for heading + body fonts — rejects unsafe font names. */
export function getGoogleFontsUrl(styles: SiteStyles): string {
  const extractPrimary = (fontStr: string | undefined): string | null => {
    if (!fontStr) return null
    const first = fontStr.split(",")[0]?.replace(/["']/g, "").trim() ?? ""
    return SAFE_FONT_NAME.test(first) ? first : null
  }
  const heading = extractPrimary(styles.fontHeading)
  const body = extractPrimary(styles.fontBody)
  const fonts = Array.from(new Set([heading, body].filter((f): f is string => !!f)))
  if (fonts.length === 0) return ""
  const params = fonts
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join("&")
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

// ─── Custom CSS sanitizer (postcss AST walk) ────────────────────────────────

/** Property names that can trigger JS execution or network fetches. */
const DANGEROUS_PROPS = new Set([
  "behavior",          // old IE
  "-moz-binding",      // old Firefox XUL
  "filter",            // old IE JS expressions
  "expression",
])

const DANGEROUS_VALUE_PATTERNS = [
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /expression\s*\(/i,
  /-moz-binding/i,
  /behavior\s*:/i,
  /@import\b/i,
]

/** Allowed @-rules. Everything else is stripped. */
const ALLOWED_AT_RULES = new Set([
  "media", "supports", "keyframes", "-webkit-keyframes", "font-face", "page", "layer",
])

function isSafeUrlValue(value: string): boolean {
  // Reject url(...) unless it's explicitly https or a data:image/... reference
  const urlMatches = value.match(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi) || []
  for (const match of urlMatches) {
    const inner = match.replace(/url\s*\(\s*["']?/i, "").replace(/["']?\s*\)$/, "").trim()
    if (!/^(https:\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i.test(inner)) {
      return false
    }
  }
  return true
}

/** Sanitize user-provided custom CSS via postcss AST walk. */
export function sanitizeCustomCss(css: string): string {
  if (!css) return ""
  const trimmed = css.slice(0, 10000)

  let root
  try {
    root = postcss.parse(trimmed)
  } catch {
    // Malformed CSS → drop everything rather than ship broken styles
    return ""
  }

  root.walkAtRules((rule: AtRule) => {
    if (!ALLOWED_AT_RULES.has(rule.name.toLowerCase())) {
      rule.remove()
      return
    }
    // Even allowed at-rules may hold dangerous params (e.g., @font-face src: url(javascript:))
    if (!isSafeUrlValue(rule.params)) rule.remove()
  })

  root.walkDecls((decl: Declaration) => {
    const prop = decl.prop.toLowerCase()
    if (DANGEROUS_PROPS.has(prop)) { decl.remove(); return }
    if (DANGEROUS_VALUE_PATTERNS.some((re) => re.test(decl.value))) { decl.remove(); return }
    if (!isSafeUrlValue(decl.value)) { decl.remove(); return }
  })

  return root.toString()
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
