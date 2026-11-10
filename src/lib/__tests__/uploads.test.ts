import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { mkdtemp, rm, readdir, writeFile } from "fs/promises"
import os from "os"
import path from "path"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user_1" } })),
}))

import { NextRequest } from "next/server"
import { detectFileType, resolveUploadPath, UPLOAD_TYPES } from "@/lib/uploads"
import { POST } from "@/app/api/upload/route"
import { GET } from "@/app/uploads/[...path]/route"

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")])
const PDF = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
const HTML = Buffer.from("<!doctype html><script>alert(document.cookie)</script>")
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00")
const WAV = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WAVEfmt ")])

describe("detectFileType", () => {
  it("detects allowed types from their magic bytes", () => {
    expect(detectFileType(PNG)).toBe(UPLOAD_TYPES.png)
    expect(detectFileType(JPEG)).toBe(UPLOAD_TYPES.jpeg)
    expect(detectFileType(WEBP)).toBe(UPLOAD_TYPES.webp)
    expect(detectFileType(PDF)).toBe(UPLOAD_TYPES.pdf)
  })

  it("rejects script-capable and unknown content", () => {
    expect(detectFileType(HTML)).toBeNull()
    expect(detectFileType(SVG)).toBeNull()
    expect(detectFileType(GIF)).toBeNull()
    expect(detectFileType(WAV)).toBeNull()
    expect(detectFileType(Buffer.alloc(0))).toBeNull()
    expect(detectFileType(PNG.subarray(0, 4))).toBeNull()
  })
})

describe("resolveUploadPath", () => {
  const root = path.resolve(os.tmpdir(), "ef-uploads-root")

  it("resolves a plain file name inside the upload dir", () => {
    expect(resolveUploadPath("3f2c9a1e-0b6d-4c2a-9f1e-123456789abc.png", root)).toBe(
      path.join(root, "3f2c9a1e-0b6d-4c2a-9f1e-123456789abc.png")
    )
  })

  it.each([
    "",
    ".",
    "..",
    "../secret.png",
    "..\\secret.png",
    "a/../../etc/passwd",
    "sub/file.png",
    "sub\\file.png",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    ".env",
    "foo..png",
    "..%2F..%2Fetc%2Fpasswd",
    "file.png\0.html",
  ])("rejects %j", (name) => {
    expect(resolveUploadPath(name, root)).toBeNull()
  })
})

describe("upload + serve routes", () => {
  let dir: string
  const originalDir = process.env.UPLOAD_DIR

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "ef-uploads-"))
    process.env.UPLOAD_DIR = dir
  })

  afterAll(async () => {
    if (originalDir === undefined) delete process.env.UPLOAD_DIR
    else process.env.UPLOAD_DIR = originalDir
    await rm(dir, { recursive: true, force: true })
  })

  function upload(content: Buffer, name: string, type: string) {
    const form = new FormData()
    form.append("file", new File([new Uint8Array(content)], name, { type }))
    return POST(new NextRequest("http://localhost/api/upload", { method: "POST", body: form }))
  }

  function fetchUpload(...segments: string[]) {
    return GET(new NextRequest(`http://localhost/uploads/${segments.join("/")}`), {
      params: Promise.resolve({ path: segments }),
    })
  }

  it("rejects an HTML file named .png with an image/png MIME type", async () => {
    const res = await upload(HTML, "avatar.png", "image/png")
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, message: "Invalid file type" })
    expect(await readdir(dir)).toEqual([])
  })

  it("rejects an SVG even when it claims to be an SVG", async () => {
    const res = await upload(SVG, "logo.svg", "image/svg+xml")
    expect(res.status).toBe(400)
  })

  it("stores a real PNG under a random name with the detected type and serves it safely", async () => {
    const res = await upload(PNG, "photo.html", "text/html")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.type).toBe("image/png")
    expect(body.data.size).toBe(PNG.length)
    expect(body.data.filename).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(body.data.url).toBe(`/uploads/${body.data.filename}`)
    expect(await readdir(dir)).toEqual([body.data.filename])

    const served = await fetchUpload(body.data.filename)
    expect(served.status).toBe(200)
    expect(served.headers.get("content-type")).toBe("image/png")
    expect(served.headers.get("x-content-type-options")).toBe("nosniff")
    expect(served.headers.get("content-security-policy")).toContain("sandbox")
    expect(served.headers.get("cache-control")).toContain("immutable")
    expect(Buffer.from(await served.arrayBuffer())).toEqual(PNG)
  })

  it("does not serve files whose bytes are not an allowed type", async () => {
    await writeFile(path.join(dir, "legacy.png"), HTML)
    const res = await fetchUpload("legacy.png")
    expect(res.status).toBe(404)
  })

  it("returns 404 for traversal and nested paths", async () => {
    await writeFile(path.join(path.dirname(dir), "ef-outside.png"), PNG)
    try {
      expect((await fetchUpload("..", "ef-outside.png")).status).toBe(404)
      expect((await fetchUpload("../ef-outside.png")).status).toBe(404)
      expect((await fetchUpload("..\\ef-outside.png")).status).toBe(404)
      expect((await fetchUpload("sub", "file.png")).status).toBe(404)
      expect((await fetchUpload("missing.png")).status).toBe(404)
    } finally {
      await rm(path.join(path.dirname(dir), "ef-outside.png"), { force: true })
    }
  })
})
