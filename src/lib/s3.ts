import crypto from "crypto"

/**
 * A minimal S3 client (PutObject / GetObject / DeleteObject) for any S3-compatible store:
 * AWS S3, Cloudflare R2, Backblaze B2, MinIO. Requests are signed with AWS Signature V4
 * using node:crypto and sent with fetch, so no SDK dependency.
 *
 * Enabled by S3_BUCKET. With S3_ENDPOINT set (R2, B2, MinIO) requests go path-style to
 * <endpoint>/<bucket>/<key>; without it, to https://<bucket>.s3.<region>.amazonaws.com/<key>.
 */

export interface S3Config {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  /** e.g. https://<account>.r2.cloudflarestorage.com, http://localhost:9000 */
  endpoint?: string
}

/** The S3 settings from the environment, or null when S3_BUCKET is not set (disk storage). */
export function s3ConfigFromEnv(env: Record<string, string | undefined> = process.env): S3Config | null {
  const bucket = env.S3_BUCKET?.trim()
  if (!bucket) return null
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim()
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim()
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3_BUCKET is set but S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing")
  }
  return {
    bucket,
    region: env.S3_REGION?.trim() || (env.S3_ENDPOINT ? "auto" : "us-east-1"),
    accessKeyId,
    secretAccessKey,
    sessionToken: env.S3_SESSION_TOKEN?.trim() || undefined,
    endpoint: env.S3_ENDPOINT?.trim().replace(/\/+$/, "") || undefined,
  }
}

// ---------------------------------------------------------------------------
// Signature V4
// ---------------------------------------------------------------------------

export const EMPTY_PAYLOAD_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

export function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex")
}

function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest()
}

/** RFC 3986 percent-encoding, as SigV4 requires (encodeURIComponent leaves !'()* alone). */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** "20130524T000000Z" */
export function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

export interface SignInput {
  method: string
  url: URL
  /** Headers to sign besides host (which is taken from the URL). Must include x-amz-date. */
  headers: Record<string, string>
  payloadHash: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
}

/** The Authorization header value for a request (AWS Signature Version 4, header form). */
export function signV4(input: SignInput): string {
  const lower: Record<string, string> = { host: input.url.host }
  for (const [name, value] of Object.entries(input.headers)) {
    lower[name.toLowerCase()] = String(value).trim().replace(/\s+/g, " ")
  }
  const amzDate = lower["x-amz-date"]
  if (!amzDate) throw new Error("x-amz-date header is required")
  const dateStamp = amzDate.slice(0, 8)

  const names = Object.keys(lower).sort()
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join("")
  const signedHeaders = names.join(";")

  // S3 paths are encoded once, segment by segment (slashes kept).
  const canonicalUri =
    input.url.pathname
      .split("/")
      .map((segment) => encodeRfc3986(decodeURIComponent(segment)))
      .join("/") || "/"
  const canonicalQuery = [...input.url.searchParams.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort(([ak, av], [bk, bv]) => (ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&")

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n")

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n")

  const kDate = hmac(`AWS4${input.secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, input.region)
  const kService = hmac(kRegion, input.service)
  const kSigning = hmac(kService, "aws4_request")
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex")

  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

// ---------------------------------------------------------------------------
// Object operations
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 15_000

export function objectUrl(config: S3Config, key: string): URL {
  const path = key.split("/").map(encodeRfc3986).join("/")
  if (config.endpoint) return new URL(`${config.endpoint}/${encodeRfc3986(config.bucket)}/${path}`)
  return new URL(`https://${config.bucket}.s3.${config.region}.amazonaws.com/${path}`)
}

export class S3Error extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "S3Error"
  }
}

async function send(
  config: S3Config,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  options: { body?: Uint8Array; headers?: Record<string, string> } = {},
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date()
): Promise<Response> {
  const url = objectUrl(config, key)
  const payloadHash = options.body ? sha256Hex(options.body) : EMPTY_PAYLOAD_HASH
  const headers: Record<string, string> = {
    ...options.headers,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": toAmzDate(now),
  }
  if (config.sessionToken) headers["x-amz-security-token"] = config.sessionToken
  headers.authorization = signV4({
    method,
    url,
    headers,
    payloadHash,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: "s3",
  })
  return fetchImpl(url, {
    method,
    headers,
    body: options.body as BodyInit | undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => "")
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1]
  throw new S3Error(`S3 ${what} failed: ${res.status}${code ? ` ${code}` : ""}`, res.status)
}

export async function putObject(
  config: S3Config,
  key: string,
  body: Uint8Array,
  contentType: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await send(config, "PUT", key, { body, headers: { "content-type": contentType } }, fetchImpl)
  if (!res.ok) await fail(res, "PutObject")
  await res.body?.cancel().catch(() => {})
}

/**
 * The object's bytes, or null when it does not exist. Objects larger than `maxBytes` are
 * refused (returned as null) without reading their body.
 */
export async function getObject(
  config: S3Config,
  key: string,
  maxBytes: number,
  fetchImpl: typeof fetch = fetch
): Promise<Buffer | null> {
  const res = await send(config, "GET", key, {}, fetchImpl)
  if (res.status === 404) {
    await res.body?.cancel().catch(() => {})
    return null
  }
  if (!res.ok) await fail(res, "GetObject")
  const declared = Number(res.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {})
    return null
  }
  const data = Buffer.from(await res.arrayBuffer())
  return data.length > maxBytes ? null : data
}

/** Deletes the object; deleting one that does not exist is not an error. */
export async function deleteObject(config: S3Config, key: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await send(config, "DELETE", key, {}, fetchImpl)
  if (!res.ok && res.status !== 404) await fail(res, "DeleteObject")
  await res.body?.cancel().catch(() => {})
}
