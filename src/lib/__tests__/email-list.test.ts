import { describe, it, expect } from "vitest"
import { emailsFromCsv, parseEmailList } from "@/lib/email-list"

// The bulk invite input: pasted lists and uploaded .csv files.
describe("parseEmailList", () => {
  it("splits on commas, semicolons, spaces and new lines, lowercases and de-duplicates", () => {
    const { emails, invalid } = parseEmailList("A@x.edu, b@x.edu;c@x.edu\nd@x.edu\r\n a@X.edu  \t e@x.edu")
    expect(emails).toEqual(["a@x.edu", "b@x.edu", "c@x.edu", "d@x.edu", "e@x.edu"])
    expect(invalid).toEqual([])
  })

  it("keeps the address of \"Name <a@b.c>\" entries and reports what isn't an address", () => {
    const { emails, invalid } = parseEmailList("Asha Rao <asha@x.edu>, not-an-email, b@x, \"c@x.edu\"")
    expect(emails).toEqual(["asha@x.edu", "c@x.edu"])
    expect(invalid).toEqual(["not-an-email", "b@x"])
  })

  it("is empty for blank input", () => {
    expect(parseEmailList("  \n ,; ")).toEqual({ emails: [], invalid: [] })
  })
})

describe("emailsFromCsv", () => {
  it("uses the column named email (any position), skipping the header", () => {
    const csv = "Name,Email,Club\nAsha,asha@x.edu,Robotics\n\"Rao, B\",b@x.edu,Drama\n"
    expect(emailsFromCsv(csv)).toEqual(["asha@x.edu", "b@x.edu"])
  })

  it("accepts e-mail / Email Address headers, semicolons and a BOM", () => {
    expect(emailsFromCsv(String.fromCharCode(0xfeff) + "name;E-mail\r\nA;a@x.edu\r\nB;b@x.edu")).toEqual(["a@x.edu", "b@x.edu"])
    expect(emailsFromCsv("Email Address\tName\na@x.edu\tA")).toEqual(["a@x.edu"])
  })

  it("falls back to the first column, keeping a first row that is already an address", () => {
    expect(emailsFromCsv("a@x.edu,A\nb@x.edu,B")).toEqual(["a@x.edu", "b@x.edu"])
    expect(emailsFromCsv("addresses\na@x.edu\nb@x.edu")).toEqual(["a@x.edu", "b@x.edu"])
  })

  it("returns an empty list for an empty file", () => {
    expect(emailsFromCsv("")).toEqual([])
    expect(emailsFromCsv("Email\n")).toEqual([])
  })
})
