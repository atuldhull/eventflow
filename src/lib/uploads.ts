import path from "path"
import crypto from "crypto"
import { mkdir, writeFile, readFile, lstat, unlink } from "fs/promises"
import { deleteObject, getObject, putObject, s3ConfigFromEnv } from "@/lib/s3"

/**
 * Upload storage. By default files live on the server's disk OUTSIDE public/ (UPLOAD_DIR,
 * default ./uploads). With S3_BUCKET set they go to an S3-compatible bucket instead (see
 * src/lib/s3.ts), so every app server sees the same files. Either way they are served at
 * /uploads/<name> by src/app/uploads/[...path]/route.ts with a fixed Content-Type and a
 * sandboxing CSP, so an uploaded file can never run script on our origin.
 */

export interface UploadType {
  mime: string
  ext: string
  maxSize: number
}

const MB = 1024 * 1024

// Types are identified by their file signature (magic bytes), never by the client-sent MIME
// type or file name. SVG and HTML are deliberately absent: both can carry script.
export const UPLOAD_TYPES = {
  jpeg: { mime: "image/jpeg", ext: "jpg", maxSize: 5 * MB },
  png: { mime: "image/png", ext: "png", maxSize: 5 * MB },
  webp: { mime: "image/webp", ext: "webp", maxSize: 5 * MB },
  pdf: { mime: "application/pdf", ext: "pdf", maxSize: 10 * MB },
} satisfies Record<string, UploadType>

export const MAX_UPLOAD_SIZE = Math.max(...Object.values(UPLOAD_TYPES).map((t) => t.maxSize))

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((b, i) => bytes[offset + i] === b)
}

/** Detect an allowed file type from its leading bytes. Returns null for anything else. */
export function detectFileType(bytes: Uint8Array): UploadType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return UPLOAD_TYPES.jpeg
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return UPLOAD_TYPES.png
  // "RIFF" <4-byte size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return UPLOAD_TYPES.webp
  }
  // "%PDF-"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return UPLOAD_TYPES.pdf
  return null
}

export function getUploadDir(): string {
  // turbopackIgnore: a runtime data dir, not a source import — without it the build's file tracer
  // copies the whole project into .next/standalone.
  return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "uploads"))
}

// One plain path segment: no separators, no leading dot, no "..".
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/

/** Whether `name` is a single plain file name that may be stored or served. */
export function isSafeUploadName(name: string): boolean {
  return typeof name === "string" && SAFE_NAME.test(name) && !name.includes("..")
}

/**
 * Resolve a requested file name to an absolute path inside the upload dir, or null if the
 * name is not a single safe segment or would resolve outside the upload dir.
 */
export function resolveUploadPath(name: string, uploadDir = getUploadDir()): string | null {
  if (!isSafeUploadName(name)) return null
  const root = path.resolve(/* turbopackIgnore: true */ uploadDir)
  const resolved = path.resolve(/* turbopackIgnore: true */ root, name)
  if (path.dirname(resolved) !== root) return null
  return resolved
}

/** Persist an already-validated upload under a random name. Returns the stored file name. */
export async function saveUpload(data: Buffer, type: UploadType): Promise<string> {
  const filename = `${crypto.randomUUID()}.${type.ext}`
  const s3 = s3ConfigFromEnv()
  if (s3) {
    await putObject(s3, filename, data, type.mime)
    return filename
  }
  const dir = getUploadDir()
  await mkdir(/* turbopackIgnore: true */ dir, { recursive: true })
  await writeFile(path.join(/* turbopackIgnore: true */ dir, filename), data, { flag: "wx" })
  return filename
}

/**
 * Read a stored upload for serving. Returns null when the name is unsafe, the file does not
 * exist or is not a regular file, or its bytes are not one of the allowed types.
 * With S3 storage, an error reaching the bucket throws (so it is not mistaken for a 404).
 */
export async function readUpload(name: string): Promise<{ data: Buffer; type: UploadType } | null> {
  const s3 = s3ConfigFromEnv()
  if (s3) {
    if (!isSafeUploadName(name)) return null
    const data = await getObject(s3, name, MAX_UPLOAD_SIZE)
    const type = data ? detectFileType(data) : null
    return data && type ? { data, type } : null
  }
  const filePath = resolveUploadPath(name)
  if (!filePath) return null
  try {
    const info = await lstat(/* turbopackIgnore: true */ filePath)
    if (!info.isFile()) return null
    const data = await readFile(/* turbopackIgnore: true */ filePath)
    const type = detectFileType(data)
    return type ? { data, type } : null
  } catch {
    return null
  }
}

/**
 * Delete a stored upload (from the bucket with S3 storage, else from UPLOAD_DIR). Returns
 * false when the name is unsafe or is not a regular file; one that is already gone counts
 * as deleted.
 */
export async function deleteUpload(name: string): Promise<boolean> {
  if (!isSafeUploadName(name)) return false
  const s3 = s3ConfigFromEnv()
  if (s3) {
    await deleteObject(s3, name)
    return true
  }
  const filePath = resolveUploadPath(name)
  if (!filePath) return false
  try {
    const info = await lstat(/* turbopackIgnore: true */ filePath)
    if (!info.isFile()) return false
    await unlink(/* turbopackIgnore: true */ filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  return true
}
