import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const output = process.env.SQLITE_AUTHORITY_INVENTORY_FILE || '/tmp/techit-sqlite-authority-inventory.json'
const files = []
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full)
    else if (entry.name.endsWith('.js') && !full.includes(`${path.sep}__tests__${path.sep}`)) {
      const text = await fs.readFile(full, 'utf8')
      const matches = [...text.matchAll(/\b(readDb|updateDb|writeDb)\s*\(/g)]
      if (matches.length) {
        const relative = path.relative(root, full)
        const nonRequest = relative.startsWith('repositories/') || relative.startsWith('services/') && (/PostgresProjection|migrationOutboxService/.test(relative))
        files.push({ file: relative, calls: matches.length, authorityClass: nonRequest ? 'projection-or-repository' : 'request-or-maintenance', lines: matches.map(match => text.slice(0, match.index).split('\n').length) })
      }
    }
  }
}
await walk(root)
files.sort((a, b) => b.calls - a.calls || a.file.localeCompare(b.file))
const requestFiles = files.filter(row => row.authorityClass === 'request-or-maintenance')
const report = { generatedAt: new Date().toISOString(), fileCount: files.length, callCount: files.reduce((sum, row) => sum + row.calls, 0), requestPathFileCount: requestFiles.length, requestPathCallCount: requestFiles.reduce((sum, row) => sum + row.calls, 0), files }
await fs.writeFile(output, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ event: 'sqlite_authority_inventory_ready', output, fileCount: report.fileCount, callCount: report.callCount, requestPathFileCount: report.requestPathFileCount, requestPathCallCount: report.requestPathCallCount }))
