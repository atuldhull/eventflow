/** Text made safe to place inside HTML (element content or a quoted attribute). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Plain text (as typed into a textarea) as email-safe HTML: escaped, line breaks kept. */
export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br/>")
}
