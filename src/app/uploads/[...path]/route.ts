import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { readUpload } from "@/lib/uploads"

// Serves files saved by /api/upload from UPLOAD_DIR (outside public/), or from the S3 bucket
// when S3_BUCKET is set. The Content-Type comes
// from the file's own bytes and only allowed types are served; nosniff + a sandboxing CSP keep
// a crafted file from ever executing as a document on this origin.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
}

async function serve(params: Promise<{ path: string[] }>, includeBody: boolean) {
  const { path: segments } = await params
  let upload: Awaited<ReturnType<typeof readUpload>>
  try {
    upload = segments?.length === 1 ? await readUpload(segments[0]) : null
  } catch (error) {
    // Only object storage (S3_BUCKET) can fail here; disk reads report a missing file as null.
    console.error("Upload storage error:", error)
    return NextResponse.json(
      { success: false, message: "Storage unavailable" },
      { status: 503, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store" } }
    )
  }

  if (!upload) {
    return NextResponse.json(
      { success: false, message: "Not found" },
      { status: 404, headers: SECURITY_HEADERS }
    )
  }

  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    "Content-Type": upload.type.mime,
    "Content-Length": String(upload.data.length),
    "Cache-Control": "public, max-age=31536000, immutable",
  }
  // Browsers will not render a PDF inside a sandboxed document, so hand PDFs over as downloads.
  if (upload.type.mime === "application/pdf") {
    headers["Content-Disposition"] = `attachment; filename="${segments[0]}"`
  }

  return new NextResponse(includeBody ? new Uint8Array(upload.data) : null, { status: 200, headers })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return serve(params, true)
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return serve(params, false)
}
