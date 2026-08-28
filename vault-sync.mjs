#!/usr/bin/env node
/**
 * Vault → CLI sync.
 *
 * Reads a Vault backup file (the .json you get from "Export Backup") and
 * installs the Hugging Face token where every HF tool looks for it:
 * ~/.cache/huggingface/token, plus a shell snippet for HF_TOKEN.
 *
 * The token never passes through a chat window or a terminal argument —
 * it goes file-to-file. Run:
 *
 *   node vault-sync.mjs                 # auto-find newest backup in ~/Downloads
 *   node vault-sync.mjs path/to/backup.json
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HOME = homedir()
const TOKEN_PATH = join(HOME, '.cache', 'huggingface', 'token')

function findNewestBackup() {
  const dirs = [join(HOME, 'Downloads'), process.cwd()]
  let best = null
  for (const dir of dirs) {
    let entries
    try { entries = readdirSync(dir) } catch { continue }
    for (const name of entries) {
      if (!/^robertson-legacy-vault-backup.*\.json$/.test(name)) continue
      const full = join(dir, name)
      const mtime = statSync(full).mtimeMs
      if (!best || mtime > best.mtime) best = { path: full, mtime }
    }
  }
  return best?.path ?? null
}

const explicit = process.argv[2]
const backupPath = explicit ?? findNewestBackup()

if (!backupPath) {
  console.error('✗ No Vault backup found.')
  console.error('  Open the site → ⚙ Vault → Export Backup, then re-run this.')
  process.exit(1)
}

let data
try {
  data = JSON.parse(readFileSync(backupPath, 'utf8'))
} catch (e) {
  console.error(`✗ Could not read ${backupPath}: ${e.message}`)
  process.exit(1)
}

const token = (data.hfToken ?? '').trim()
if (!token) {
  console.error(`✗ ${backupPath} contains no hfToken.`)
  process.exit(1)
}

// Verify before writing — never install a dead token.
const res = await fetch('https://huggingface.co/api/whoami-v2', {
  headers: { Authorization: `Bearer ${token}` },
})
if (!res.ok) {
  console.error(`✗ Token rejected by Hugging Face (HTTP ${res.status}). Not written.`)
  console.error('  Generate a new write-scope token and re-export the backup.')
  process.exit(1)
}
const who = await res.json()
const role = who?.auth?.accessToken?.role ?? 'unknown'

mkdirSync(join(HOME, '.cache', 'huggingface'), { recursive: true })
writeFileSync(TOKEN_PATH, token, { mode: 0o600 })
chmodSync(TOKEN_PATH, 0o600)

console.log(`✓ Token verified as "${who.name}" (role: ${role})`)
console.log(`✓ Written to ${TOKEN_PATH} (mode 600)`)
console.log('')
console.log('  Every HF tool on this machine now authenticates automatically.')
console.log('  For the current shell you can also run:  export HF_TOKEN=$(cat ~/.cache/huggingface/token)')

if (role !== 'write' && role !== 'admin') {
  console.log('')
  console.log(`⚠ This token's role is "${role}" — deploys need write scope.`)
}
