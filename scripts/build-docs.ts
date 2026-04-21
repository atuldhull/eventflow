/**
 * Renders the two HTML documents in scripts/docs/ to PDFs in docs/.
 *
 * Uses puppeteer-core driving an installed Chrome / Edge instead of pulling
 * down a bundled Chromium (which is ~200MB). On Windows, Chrome or Edge is
 * almost always present — the detection table below covers the standard
 * install paths plus the per-user install location.
 *
 * Run with:  npx tsx scripts/build-docs.ts
 */
import puppeteer from "puppeteer-core"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

// ── Locate a Chromium-based browser ────────────────────────────────────────
const CANDIDATE_PATHS: string[] = [
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe") : "",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/microsoft-edge",
].filter(Boolean)

function findBrowser(): string {
  const overridden = process.env.PUPPETEER_EXECUTABLE_PATH
  if (overridden && fs.existsSync(overridden)) return overridden
  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) return p
  }
  throw new Error(
    "Couldn't find Chrome or Edge. Set PUPPETEER_EXECUTABLE_PATH to your browser binary and re-run."
  )
}

// ── Stamp today's date into the HTML so the PDF isn't frozen at Apr 2026 ──
function stampDate(html: string): string {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })
  return html.replace(/DOCUMENT_DATE/g, today)
}

async function renderPdf(browser: Awaited<ReturnType<typeof puppeteer.launch>>, htmlPath: string, pdfPath: string) {
  // Write a date-stamped copy alongside the source so the file:// load resolves
  // ./shared.css naturally. A single-step load is faster and more reliable than
  // the goto + setContent combo which deadlocks on `networkidle0` under
  // puppeteer-core 24.
  const stamped = stampDate(fs.readFileSync(htmlPath, "utf8"))
  const tmpPath = htmlPath.replace(/\.html$/, ".__render__.html")
  fs.writeFileSync(tmpPath, stamped, "utf8")

  const page = await browser.newPage()
  try {
    await page.emulateMediaType("print")
    await page.goto(pathToFileURL(tmpPath).toString(), { waitUntil: "load", timeout: 60_000 })
    // Give web fonts / pending layout a beat to settle before capturing.
    await new Promise((r) => setTimeout(r, 400))
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,   // Honour @page size/margin declared in CSS
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
  } finally {
    await page.close()
    fs.unlinkSync(tmpPath)
  }
}

async function main() {
  const browserPath = findBrowser()
  console.log(`📦 Using browser: ${browserPath}`)

  const docsDir = path.join(process.cwd(), "scripts", "docs")
  const outDir  = path.join(process.cwd(), "docs")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const jobs = [
      ["user-guide.html",       "user-guide.pdf"],
      ["admin-reference.html",  "admin-reference.pdf"],
    ] as const

    console.log("📄 Rendering PDFs...")
    for (const [src, dst] of jobs) {
      const srcPath = path.join(docsDir, src)
      const dstPath = path.join(outDir, dst)
      await renderPdf(browser, srcPath, dstPath)
      const size = fs.statSync(dstPath).size
      console.log(`  ✓ ${dst}  (${(size / 1024).toFixed(1)} KB)`)
    }
    console.log("\n✅ Done.")
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
