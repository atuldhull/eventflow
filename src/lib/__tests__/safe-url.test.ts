import { describe, it, expect } from "vitest"
import { isSafeMediaUrl } from "@/lib/safe-url"

describe("isSafeMediaUrl (website media links)", () => {
  it("accepts web links and our own uploads", () => {
    for (const ok of ["https://cdn.example.com/a.png", "http://example.com/x.jpg", "/uploads/org/abc.png"]) {
      expect(isSafeMediaUrl(ok), ok).toBe(true)
    }
  })

  it("refuses script and data schemes, tricks and junk", () => {
    for (const bad of [
      "javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x",
      "/uploads/../.env", "//evil.example/x.png", "/uploads//evil.example/x", "/etc/passwd",
      "https://x.com/a.png\" onerror=\"alert(1)", "", null, 42,
    ]) {
      expect(isSafeMediaUrl(bad), String(bad)).toBe(false)
    }
  })
})
