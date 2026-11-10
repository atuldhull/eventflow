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
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/permissions"

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

// ── Permission tables, generated from the real role map ─────────────────────
// <!--MATRIX Label=perm:key; ...--> becomes a role grid; <!--APPENDIX--> lists every
// permission with its holders. Keeps the PDF from drifting away from the code.
const ROLES = [
  ["SUPER_ADMIN", "Super", "Super"],
  ["ENTERPRISE_ADMIN", "Ent adm", "Ent Admin"],
  ["ENTERPRISE_MANAGER", "Ent mgr", "Ent Manager"],
  ["ORG_ADMIN", "Org adm", "Org Admin"],
  ["EVENT_MANAGER", "Event mgr", "Event Manager"],
  ["COORDINATOR", "Coord", "Coordinator"],
  ["FINANCE_MANAGER", "Finance", "Finance"],
  ["VIEWER", "Viewer", "Viewer"],
] as const
const holds = (role: string, perm: string) =>
  (ROLE_PERMISSIONS as Record<string, readonly string[]>)[role].includes(perm)

function matrix(spec: string): string {
  const rows = spec.split(";").map((s) => s.trim()).filter(Boolean).map((pair) => {
    const [label, perm] = pair.split("=").map((s) => s.trim())
    if (!Object.values(PERMISSIONS).includes(perm as never)) throw new Error(`Unknown permission in docs: ${perm}`)
    const cells = ROLES.map(([r]) => `<td><span class="${holds(r, perm) ? "yes" : "no"}"></span></td>`).join("")
    return `<tr><td>${label}</td>${cells}</tr>`
  })
  const head = ROLES.map(([, short]) => `<th>${short}</th>`).join("")
  return `<table class="perm"><thead><tr><th>Action</th>${head}</tr></thead><tbody>${rows.join("")}</tbody></table>`
}

function appendix(): string {
  const groups = new Map<string, string[]>()
  for (const perm of Object.values(PERMISSIONS)) {
    const g = perm.split(":")[0]
    groups.set(g, [...(groups.get(g) ?? []), perm])
  }
  const title = (g: string) => ({ enterprise: "Enterprise", org: "Organization", member: "Members", event: "Events",
    registration: "Registrations", payment: "Payments", checkin: "Check-in", communication: "Communication",
    certificate: "Certificates", coupon: "Coupons", analytics: "Analytics", audit: "Audit", platform: "Platform" } as Record<string, string>)[g] ?? g
  return [...groups].map(([g, perms]) => {
    const rows = perms.map((p) => {
      const who = ROLES.slice(1).filter(([r]) => holds(r, p)).map(([, , long]) => long)
      return `<tr><td><code>${p}</code></td><td>${who.length ? who.join(", ") : "Super Admin only"}</td></tr>`
    }).join("")
    return `<h3>${title(g)}</h3><table class="kv mono">${rows}</table>`
  }).join("\n")
}

function fillTables(html: string): string {
  return html
    .replace(/<!--MATRIX ([\s\S]*?)-->/g, (_, spec: string) => matrix(spec))
    .replace(/<!--APPENDIX-->/g, () => appendix())
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
  const stamped = fillTables(stampDate(fs.readFileSync(htmlPath, "utf8")))
  const tmpPath = htmlPath.replace(/\.html$/, ".__render__.html")
  fs.writeFileSync(tmpPath, stamped, "utf8")

  const page = await browser.newPage()
  const title = htmlPath.includes("admin") ? "Admin Reference" : "User Guide"
  try {
    await page.emulateMediaType("print")
    await page.goto(pathToFileURL(tmpPath).toString(), { waitUntil: "load", timeout: 60_000 })
    // The pages use Google Fonts; wait for them so the PDF never falls back mid-render.
    await page.evaluate(() => document.fonts.ready)
    await new Promise((r) => setTimeout(r, 400))
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,   // Honour @page size/margins declared in CSS
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      // Running footer with page numbers. The cover page has no margin, so it gets none.
      footerTemplate: `<div style="width:100%;padding:0 16mm;display:flex;justify-content:space-between;font:600 7.5pt Segoe UI,Arial,sans-serif;color:#8a8780;letter-spacing:.06em;text-transform:uppercase"><span>EventFlow · ${title}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
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
