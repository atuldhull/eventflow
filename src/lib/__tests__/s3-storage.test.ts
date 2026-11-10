import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest"
import { mkdtemp, rm, readdir, writeFile } from "fs/promises"
import os from "os"
import path from "path"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user_1" } })),
}))

import { NextRequest } from "next/server"
import {
  signV4,
  sha256Hex,
  toAmzDate,
  objectUrl,
  putObject,
  getObject,
  deleteObject,
  s3ConfigFromEnv,
  EMPTY_PAYLOAD_HASH,
  type S3Config,
} from "@/lib/s3"
import { deleteUpload, readUpload } from "@/lib/uploads"
import { POST } from "@/app/api/upload/route"
import { GET } from "@/app/uploads/[...path]/route"

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])
const PDF = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
const HTML = Buffer.from("<!doctype html><script>alert(1)</script>")

describe("Signature V4", () => {
  // AWS SigV4 test suite, "get-vanilla"
  it("matches the get-vanilla test vector", () => {
    const authorization = signV4({
      method: "GET",
      url: new URL("https://example.amazonaws.com/"),
      headers: { "X-Amz-Date": "20150830T123600Z" },
      payloadHash: EMPTY_PAYLOAD_HASH,
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "us-east-1",
      service: "service",
    })
    expect(authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, " +
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
    )
  })

  // AWS S3 docs, "Signature Calculations for the Authorization Header: Transferring Payload in
  // a Single Chunk", example GET Object
  it("matches the S3 GET Object documentation example", () => {
    const authorization = signV4({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: {
        Range: "bytes=0-9",
        "x-amz-content-sha256": EMPTY_PAYLOAD_HASH,
        "x-amz-date": "20130524T000000Z",
      },
      payloadHash: EMPTY_PAYLOAD_HASH,
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      region: "us-east-1",
      service: "s3",
    })
    expect(authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
        "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, " +
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
    )
  })

  it("formats x-amz-date", () => {
    expect(toAmzDate(new Date("2013-05-24T00:00:00.123Z"))).toBe("20130524T000000Z")
  })
})

describe("S3 config and URLs", () => {
  it("is off without S3_BUCKET", () => {
    expect(s3ConfigFromEnv({})).toBeNull()
  })

  it("requires credentials once a bucket is set", () => {
    expect(() => s3ConfigFromEnv({ S3_BUCKET: "b" })).toThrow(/S3_ACCESS_KEY_ID/)
  })

  it("uses virtual-hosted AWS URLs, or path-style with S3_ENDPOINT", () => {
    const aws = s3ConfigFromEnv({ S3_BUCKET: "media", S3_REGION: "eu-west-1", S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "s" })!
    expect(objectUrl(aws, "x.png").href).toBe("https://media.s3.eu-west-1.amazonaws.com/x.png")

    const r2 = s3ConfigFromEnv({
      S3_BUCKET: "media",
      S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com/",
      S3_ACCESS_KEY_ID: "a",
      S3_SECRET_ACCESS_KEY: "s",
    })!
    expect(r2.region).toBe("auto")
    expect(objectUrl(r2, "x.png").href).toBe("https://acct.r2.cloudflarestorage.com/media/x.png")
  })
})

const CONFIG: S3Config = {
  bucket: "media",
  region: "us-east-1",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  endpoint: "http://localhost:9000",
}

function mockFetch(respond: (url: string, init: RequestInit) => Response) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => respond(String(input), init ?? {}))
}

function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>
}

describe("S3 object requests", () => {
  it("PUT sends the body, its hash, content-type and a signature", async () => {
    const fetchImpl = mockFetch(() => new Response(null, { status: 200 }))
    await putObject(CONFIG, "a.png", PNG, "image/png", fetchImpl as unknown as typeof fetch)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe("http://localhost:9000/media/a.png")
    expect(init!.method).toBe("PUT")
    expect(init!.body).toBe(PNG)
    const h = headersOf(init!)
    expect(h["content-type"]).toBe("image/png")
    expect(h["x-amz-content-sha256"]).toBe(sha256Hex(PNG))
    expect(h["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/)
    expect(h.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/
    )
  })

  it("PUT throws with the S3 error code on failure", async () => {
    const fetchImpl = mockFetch(() => new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 }))
    await expect(putObject(CONFIG, "a.png", PNG, "image/png", fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "S3 PutObject failed: 403 AccessDenied"
    )
  })

  it("GET returns the bytes, null for 404 or oversized objects, and throws otherwise", async () => {
    let fetchImpl = mockFetch(() => new Response(new Uint8Array(PNG), { status: 200 }))
    expect(await getObject(CONFIG, "a.png", 100, fetchImpl as unknown as typeof fetch)).toEqual(PNG)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe("http://localhost:9000/media/a.png")
    expect(init!.method).toBe("GET")
    expect(init!.body).toBeUndefined()
    expect(headersOf(init!)["x-amz-content-sha256"]).toBe(EMPTY_PAYLOAD_HASH)
    expect(headersOf(init!).authorization).toContain("SignedHeaders=host;x-amz-content-sha256;x-amz-date")

    fetchImpl = mockFetch(() => new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 }))
    expect(await getObject(CONFIG, "a.png", 100, fetchImpl as unknown as typeof fetch)).toBeNull()

    fetchImpl = mockFetch(() => new Response(new Uint8Array(PNG), { status: 200 }))
    expect(await getObject(CONFIG, "a.png", 4, fetchImpl as unknown as typeof fetch)).toBeNull()

    fetchImpl = mockFetch(() => new Response("oops", { status: 500 }))
    await expect(getObject(CONFIG, "a.png", 100, fetchImpl as unknown as typeof fetch)).rejects.toThrow("500")
  })

  it("DELETE is signed and treats a missing object as deleted", async () => {
    let fetchImpl = mockFetch(() => new Response(null, { status: 204 }))
    await deleteObject(CONFIG, "a.png", fetchImpl as unknown as typeof fetch)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe("http://localhost:9000/media/a.png")
    expect(init!.method).toBe("DELETE")
    expect(headersOf(init!).authorization).toMatch(/^AWS4-HMAC-SHA256 /)

    fetchImpl = mockFetch(() => new Response(null, { status: 404 }))
    await expect(deleteObject(CONFIG, "a.png", fetchImpl as unknown as typeof fetch)).resolves.toBeUndefined()
  })

  it("signs a session token when one is set", async () => {
    const fetchImpl = mockFetch(() => new Response(null, { status: 204 }))
    await deleteObject({ ...CONFIG, sessionToken: "tok" }, "a.png", fetchImpl as unknown as typeof fetch)
    const h = headersOf(fetchImpl.mock.calls[0][1]!)
    expect(h["x-amz-security-token"]).toBe("tok")
    expect(h.authorization).toContain("x-amz-security-token")
  })
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

const S3_ENV = {
  S3_BUCKET: "media",
  S3_ENDPOINT: "http://minio.test:9000",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
}

describe("uploads with S3_BUCKET set", () => {
  const bucket = new Map<string, Buffer>()
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const key = new URL(String(input)).pathname.replace(/^\/media\//, "")
    const method = init?.method ?? "GET"
    if (method === "PUT") {
      bucket.set(key, Buffer.from(init!.body as Uint8Array))
      return new Response(null, { status: 200 })
    }
    if (method === "DELETE") {
      bucket.delete(key)
      return new Response(null, { status: 204 })
    }
    const data = bucket.get(key)
    return data ? new Response(new Uint8Array(data), { status: 200 }) : new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 })
  })

  beforeAll(() => {
    for (const [k, v] of Object.entries(S3_ENV)) vi.stubEnv(k, v)
    vi.stubGlobal("fetch", fetchMock)
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    fetchMock.mockClear()
  })

  it("stores a validated upload in the bucket and serves it with the usual headers", async () => {
    const res = await upload(PNG, "photo.html", "text/html")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.url).toBe(`/uploads/${body.data.filename}`)
    expect([...bucket.keys()]).toEqual([body.data.filename])
    expect(String(fetchMock.mock.calls[0][0])).toBe(`http://minio.test:9000/media/${body.data.filename}`)

    const served = await fetchUpload(body.data.filename)
    expect(served.status).toBe(200)
    expect(served.headers.get("content-type")).toBe("image/png")
    expect(served.headers.get("content-length")).toBe(String(PNG.length))
    expect(served.headers.get("x-content-type-options")).toBe("nosniff")
    expect(served.headers.get("content-security-policy")).toContain("sandbox")
    expect(served.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(Buffer.from(await served.arrayBuffer())).toEqual(PNG)
  })

  it("still rejects bad types without touching the bucket", async () => {
    const res = await upload(HTML, "a.png", "image/png")
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("serves PDFs as downloads and refuses objects that are not an allowed type", async () => {
    bucket.set("doc.pdf", PDF)
    bucket.set("evil.png", HTML)
    const pdf = await fetchUpload("doc.pdf")
    expect(pdf.headers.get("content-disposition")).toBe('attachment; filename="doc.pdf"')
    expect((await fetchUpload("evil.png")).status).toBe(404)
  })

  it("rejects traversal and nested names before asking the bucket", async () => {
    for (const segments of [[".."], ["../x.png"], ["sub", "x.png"], [".env"], ["missing.png"]]) {
      expect((await fetchUpload(...segments)).status).toBe(404)
    }
    // only the well-formed "missing.png" reached S3
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("answers 503 (not cached) when the bucket errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    fetchMock.mockImplementationOnce(async () => new Response("down", { status: 500 }))
    const res = await fetchUpload("a.png")
    expect(res.status).toBe(503)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("deletes from the bucket", async () => {
    bucket.set("gone.png", PNG)
    expect(await deleteUpload("gone.png")).toBe(true)
    expect(bucket.has("gone.png")).toBe(false)
    expect(await deleteUpload("../gone.png")).toBe(false)
  })
})

describe("uploads without S3_BUCKET (disk)", () => {
  let dir: string
  const fetchSpy = vi.fn()

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "ef-uploads-disk-"))
    vi.stubEnv("UPLOAD_DIR", dir)
    vi.stubEnv("S3_BUCKET", "")
    vi.stubGlobal("fetch", fetchSpy)
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    await rm(dir, { recursive: true, force: true })
  })

  it("writes, reads and deletes on disk and never calls fetch", async () => {
    const res = await upload(PNG, "p.png", "image/png")
    const { data } = await res.json()
    expect(await readdir(dir)).toEqual([data.filename])
    expect((await readUpload(data.filename))?.type.mime).toBe("image/png")
    expect(await deleteUpload(data.filename)).toBe(true)
    expect(await readdir(dir)).toEqual([])
    expect(await deleteUpload(data.filename)).toBe(true) // already gone
    await writeFile(path.join(dir, "keep.png"), PNG)
    expect(await deleteUpload("../keep.png")).toBe(false)
    expect(await readdir(dir)).toEqual(["keep.png"])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
