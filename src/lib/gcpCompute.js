/**
 * GCP Compute Engine on-demand control.
 * Starts / stops the Photo Lab VM via the GCP REST API.
 *
 * Requires:
 *   Vault → Google Cloud → API Key   (GCP API key with Compute Engine access)
 *   Vault → Google Cloud → Backend URL  (used to derive project/zone/instance from stored settings,
 *                                        OR set VITE_GCP_PROJECT / VITE_GCP_ZONE / VITE_GCP_INSTANCE)
 *
 * GCP Compute REST: https://cloud.google.com/compute/docs/reference/rest/v1/instances
 */

const PROJECT  = import.meta.env.VITE_GCP_PROJECT  || 'YOUR_PROJECT_ID'
const ZONE     = import.meta.env.VITE_GCP_ZONE     || 'us-central1-a'
const INSTANCE = import.meta.env.VITE_GCP_INSTANCE || 'robertson-photo-lab'

function getGcpKey() {
  try {
    const s = JSON.parse(localStorage.getItem('robertson-legacy:settings') || '{}')
    return s.gcpKey || import.meta.env.VITE_GCP_API_KEY || ''
  } catch { return '' }
}

function computeUrl(action) {
  return `https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${ZONE}/instances/${INSTANCE}/${action}?key=${getGcpKey()}`
}

/** Get VM status: RUNNING | TERMINATED | STAGING | STOPPING | … */
export async function getInstanceStatus() {
  const key = getGcpKey()
  if (!key) return { status: 'UNKNOWN', reason: 'No GCP API key — open the Vault (⚙)' }
  try {
    const url = `https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${ZONE}/instances/${INSTANCE}?key=${key}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { status: 'ERROR', reason: err?.error?.message || `HTTP ${res.status}` }
    }
    const data = await res.json()
    return { status: data.status, networkIP: data.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP }
  } catch (e) {
    return { status: 'ERROR', reason: e.message }
  }
}

/** Start (wake) the VM. Returns when the start request is accepted (not when fully ready). */
export async function startInstance() {
  const key = getGcpKey()
  if (!key) throw new Error('No GCP API key in Vault')
  const res = await fetch(computeUrl('start'), { method: 'POST', signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  return res.json()
}

/** Stop (sleep) the VM. */
export async function stopInstance() {
  const key = getGcpKey()
  if (!key) throw new Error('No GCP API key in Vault')
  const res = await fetch(computeUrl('stop'), { method: 'POST', signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Poll until the VM backend is reachable (RUNNING + /api/health returns 200).
 * Calls onTick(secondsWaited) every 5 seconds.
 * Resolves when ready, rejects after timeoutMs.
 */
export async function waitUntilReady(backendUrl, onTick, timeoutMs = 3 * 60 * 1000) {
  const start = Date.now()
  let elapsed = 0
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 5000))
    elapsed = Math.round((Date.now() - start) / 1000)
    onTick?.(elapsed)
    try {
      const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(4000) })
      if (res.ok) return true
    } catch { /* still booting */ }
  }
  throw new Error('GPU did not come online within 3 minutes. Try again.')
}
