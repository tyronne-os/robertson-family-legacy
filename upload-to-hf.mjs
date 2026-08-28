import { uploadFiles, commit } from '@huggingface/hub'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { homedir } from 'os'

const REPO = 'AIBRUH/robertson-family-legacy'
const DIST = '/home/hunt/Downloads/family Reunion/dist'

// Read token from stored HF credential (value never printed)
let token
const tokenPaths = [
  join(homedir(), '.cache', 'huggingface', 'token'),
  join(homedir(), '.huggingface', 'token'),
]
for (const p of tokenPaths) {
  try { token = readFileSync(p, 'utf8').trim(); break } catch {}
}
if (!token && process.env.HF_TOKEN) token = process.env.HF_TOKEN
if (!token) {
  console.error('No HF token found. Run: huggingface-cli login  OR  export HF_TOKEN=...')
  process.exit(1)
}
console.log('Token found ✓')

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

const allFiles = walk(DIST)
console.log(`Uploading ${allFiles.length} files to hf://spaces/${REPO} …`)

const uploads = allFiles.map((full) => ({
  path: relative(DIST, full),
  content: new Blob([readFileSync(full)]),
}))

try {
  await uploadFiles({
    repo: { type: 'space', name: REPO },
    accessToken: token,
    files: uploads,
    commitTitle: 'Deploy Robertson Family Legacy site',
  })
  console.log('✓ Upload complete')
  console.log(`Live at: https://huggingface.co/spaces/${REPO}`)
} catch (err) {
  console.error('Upload failed:', err.message)
  process.exit(1)
}
