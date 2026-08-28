/**
 * Client for the GCP Janus-Pro-7B photo restoration backend.
 * Set VITE_GCP_BACKEND_URL in your .env to point at the Spot VM.
 */

function getBase() {
  const envUrl = import.meta.env.VITE_GCP_BACKEND_URL ?? ''
  if (envUrl) return envUrl.replace(/\/$/, '')
  try {
    const s = JSON.parse(localStorage.getItem('robertson-legacy:settings') || '{}')
    return (s.gcpUrl ?? '').replace(/\/$/, '')
  } catch {
    return ''
  }
}

async function post(path, body) {
  const BASE = getBase()
  if (!BASE) throw new Error('GCP backend URL is not set. Open the Vault (⚙) and add your Backend URL under Google Cloud.')
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`GCP backend error ${res.status}: ${msg}`)
  }
  return res.json()
}

/**
 * Convert a File/Blob to a base64 data-URI string.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Send an image to the GCP backend for full restoration.
 * @param {string} base64  — data-URI string
 * @param {string} [prompt]
 * @returns {Promise<string>}  — restored image as data-URI
 */
export async function restorePhoto(base64, prompt) {
  const data = await post('/api/restore', { image: base64, ...(prompt ? { prompt } : {}) })
  return data.image
}

/**
 * Send an already-restored image back for conversational refinement.
 * @param {string} base64  — data-URI string
 * @param {string} prompt  — e.g. "warm up the skin tones"
 * @returns {Promise<string>}  — refined image as data-URI
 */
export async function refinePhoto(base64, prompt) {
  const data = await post('/api/chat-refine', { image: base64, prompt })
  return data.image
}

/**
 * Health-check the GCP backend.
 */
export async function checkBackendHealth() {
  const BASE = getBase()
  if (!BASE) return { ok: false, reason: 'Backend URL not set — open the Vault (⚙) to add it' }
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: true, ...data }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}
