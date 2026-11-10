// Runs the organizer / door-volunteer suite in order, one browser at a time, then cleans up.
// Usage: node e2e/organizer/run-all.cjs [--keep]   (--keep skips the final cleanup)
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const L = require('./lib.cjs')

const scripts = ['01-event-lifecycle', '02-registrations', '03-checkin', '04-certificates', '05-communications', '06-members', '07-overview-analytics-audit', '08-settings-website', '09-cross-tenant']
const keep = process.argv.includes('--keep')

// start from a clean slate (removes leftovers of an interrupted run)
spawnSync(process.execPath, [path.join(__dirname, 'cleanup.cjs')], { stdio: 'inherit' })
const summary = []
for (const s of scripts) {
  console.log(`\n===== ${s} =====`)
  spawnSync(process.execPath, [path.join(__dirname, `${s}.cjs`)], { stdio: 'inherit' })
  try {
    const r = JSON.parse(fs.readFileSync(path.join(L.OUT, 'results', `${s}.json`), 'utf8'))
    summary.push(`${s.padEnd(30)} ${String(r.pass).padStart(3)} pass ${String(r.fail).padStart(3)} fail  ${r.ux.length} ux notes`)
  } catch { summary.push(`${s.padEnd(30)} (no result file)`) }
}
if (!keep) {
  console.log('\n===== cleanup =====')
  spawnSync(process.execPath, [path.join(__dirname, 'cleanup.cjs')], { stdio: 'inherit' })
}
console.log('\n' + summary.join('\n'))
console.log(`\nResults, screenshots and CSV downloads: ${L.OUT}`)
