import { describe, it, expect } from "vitest"
import { getPasswordChangedAt, withPasswordChangedAt, signedInBeforePasswordChange } from "@/lib/password-change"

describe("password change record", () => {
  it("keeps the other metadata keys when recording a change", () => {
    const at = new Date("2026-11-08T10:00:00.000Z")
    expect(withPasswordChangedAt({ notificationPreferences: { a: 1 } }, at)).toEqual({
      notificationPreferences: { a: 1 },
      passwordChangedAt: "2026-11-08T10:00:00.000Z",
    })
    expect(withPasswordChangedAt(null, at)).toEqual({ passwordChangedAt: "2026-11-08T10:00:00.000Z" })
    expect(withPasswordChangedAt(["not", "an", "object"], at)).toEqual({ passwordChangedAt: "2026-11-08T10:00:00.000Z" })
  })

  it("reads the change time back, ignoring anything malformed", () => {
    expect(getPasswordChangedAt({ passwordChangedAt: "2026-11-08T10:00:00.000Z" })).toBe(Date.parse("2026-11-08T10:00:00.000Z"))
    expect(getPasswordChangedAt({ passwordChangedAt: "yesterday" })).toBeNull()
    expect(getPasswordChangedAt({ passwordChangedAt: 123 })).toBeNull()
    expect(getPasswordChangedAt(null)).toBeNull()
  })

  it("flags only sessions that signed in before the change", () => {
    const metadata = { passwordChangedAt: "2026-11-08T10:00:00.000Z" }
    const changedAt = Date.parse(metadata.passwordChangedAt)
    expect(signedInBeforePasswordChange(changedAt - 1, metadata)).toBe(true)
    expect(signedInBeforePasswordChange(undefined, metadata)).toBe(true)
    expect(signedInBeforePasswordChange(changedAt, metadata)).toBe(false)
    expect(signedInBeforePasswordChange(changedAt + 1, metadata)).toBe(false)
    expect(signedInBeforePasswordChange(undefined, {})).toBe(false)
  })
})
