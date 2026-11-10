import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { MAX_UPLOAD_SIZE, detectFileType, saveUpload } from "@/lib/uploads"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ success: false, message: "File too large" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate the type from the file's own bytes; the client MIME type and name are ignored.
    const type = detectFileType(buffer)
    if (!type) {
      return NextResponse.json({ success: false, message: "Invalid file type" }, { status: 400 })
    }

    // 5MB for images, 10MB for PDFs
    if (buffer.length > type.maxSize) {
      return NextResponse.json({ success: false, message: "File too large" }, { status: 400 })
    }

    const filename = await saveUpload(buffer, type)

    return NextResponse.json({
      success: true,
      data: { url: `/uploads/${filename}`, filename, size: buffer.length, type: type.mime },
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ success: false, message: "Upload failed" }, { status: 500 })
  }
}
