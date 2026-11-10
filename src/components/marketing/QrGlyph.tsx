/**
 * A decorative QR-like glyph for illustrations: a 21×21 grid with real finder
 * and timing patterns and data modules seeded from `seed`, so the same code
 * always draws the same glyph (server and client agree). Not scannable.
 */
export function QrGlyph({ seed, className }: { seed: string; className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} shapeRendering="crispEdges" aria-hidden focusable="false">
      <path d={modules(seed)} fill="currentColor" />
    </svg>
  )
}

const FINDERS: [number, number][] = [
  [0, 0],
  [14, 0],
  [0, 14],
]

function modules(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), h | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  let d = ""
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      let on: boolean
      const finder = FINDERS.find(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)
      const separator = FINDERS.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7)
      if (finder) {
        const dx = x - finder[0]
        const dy = y - finder[1]
        on = dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
      } else if (separator) {
        on = false
      } else if (x === 6 || y === 6) {
        on = (x + y) % 2 === 0
      } else {
        on = rand() < 0.5
      }
      if (on) d += `M${x} ${y}h1v1h-1z`
    }
  }
  return d
}
