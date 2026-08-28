#!/usr/bin/env node
/**
 * Pre-render chapter narration to static audio files.
 *
 * Chapter text is static, so synthesizing it in the browser on every visit is
 * wasted work: it forces an ~80MB model download on the visitor, runs slowly
 * on weak devices, and makes autoplay unreliable. Rendering once here turns
 * narration into a plain audio file the browser can play instantly.
 *
 * Kokoro-82M is small enough to run on CPU — no GPU required.
 *
 *   npm run narrate              # every chapter, every voice
 *   npm run narrate -- 6         # just chapter 6
 *   npm run narrate -- 6 af_bella
 */

import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// Kokoro emits WAV, which is ~12x larger than it needs to be for speech.
// Compressing to 64kbps mono MP3 takes a chapter from ~2.7MB to ~220KB —
// the difference between a deployable Space and a 190MB one.
function haveFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'public', 'audio', 'narration')

const VOICES = [
  'af_heart', 'af_bella', 'af_nicole', 'af_sarah',
  'af_nova', 'af_sky', 'bf_emma', 'bf_isabella',
]

// Read chapter data without a bundler by stripping the ESM export syntax.
const { chapters } = await import('./src/data/chapters.js')

function fullText(ch) {
  return [
    ...ch.paragraphs,
    ...ch.sections.flatMap((s) => [s.heading, s.body]),
  ].join('\n\n')
}

const [argChapter, argVoice] = process.argv.slice(2)

const targets = chapters.filter(
  (c) => c.status === 'complete' && (!argChapter || String(c.id) === argChapter),
)

// By default, render only each chapter's own assigned voice — that's the
// only one ever actually used at runtime. Pass a voice explicitly to
// render an alternate for testing (e.g. `npm run narrate -- 6 af_bella`).
function voicesFor(ch) {
  return argVoice ? [argVoice] : [ch.voice || 'af_bella']
}

if (targets.length === 0) {
  console.error('No complete chapters to narrate.')
  process.exit(1)
}

console.log(`Loading Kokoro-82M (first run downloads ~90MB, then cached)…`)
const { KokoroTTS } = await import('kokoro-js')
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
})
console.log('Model ready.\n')

const ffmpeg = haveFfmpeg()
if (!ffmpeg) {
  console.warn('⚠ ffmpeg not found — writing uncompressed WAV (~12x larger). Install ffmpeg for MP3 output.\n')
}

mkdirSync(OUT_DIR, { recursive: true })

let made = 0
let skipped = 0

for (const ch of targets) {
  const text = fullText(ch)
  for (const voice of voicesFor(ch)) {
    const stem = `ch${String(ch.id).padStart(2, '0')}-${voice}`
    const finalExt = ffmpeg ? 'mp3' : 'wav'
    const out = join(OUT_DIR, `${stem}.${finalExt}`)

    if (existsSync(out) && !process.env.FORCE) {
      console.log(`· ${stem}.${finalExt} — exists, skipping (FORCE=1 to overwrite)`)
      skipped++
      continue
    }

    process.stdout.write(`· ${stem}.${finalExt} … `)
    const started = Date.now()
    const audio = await tts.generate(text, { voice })
    const wavPath = join(OUT_DIR, `${stem}.wav`)
    writeFileSync(wavPath, Buffer.from(await audio.toBlob().arrayBuffer()))

    if (ffmpeg) {
      execFileSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', wavPath,
        '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1',
        out,
      ])
      unlinkSync(wavPath)
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`done in ${secs}s`)
    made++
  }
}

console.log(`\n✓ ${made} file(s) written, ${skipped} skipped → public/audio/narration/`)
if (made > 0) {
  console.log('  Run `npm run build`, then deploy — narration now plays instantly.')
}
