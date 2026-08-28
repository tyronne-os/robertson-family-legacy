// Declared access requirements for this project.
//
// The Vault reads this to know — and to tell you — exactly what credentials
// the site needs, what scope each one must carry, and what breaks without it.
// Nothing here is guesswork: each entry is verified live against the provider.

export const VAULT_STORAGE_KEY = 'robertson-legacy:settings'

export const ACCESS_REQUIREMENTS = [
  {
    id: 'hfToken',
    label: 'Hugging Face token',
    field: 'hfToken',
    requiredScope: 'write',
    required: true,
    usedFor: 'Deploying the built site to the Robertson Legacy Space.',
    breaksWithout: 'Save & Deploy cannot push — the site goes stale.',
    generateAt: 'https://huggingface.co/settings/tokens',
  },
  {
    id: 'gcpKey',
    label: 'Google Cloud API key',
    field: 'gcpKey',
    requiredScope: null,
    required: false,
    usedFor: 'Starting and stopping the Photo Lab GPU VM on demand.',
    breaksWithout: 'GPU must be started manually from the gcloud CLI.',
    generateAt: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'gcpUrl',
    label: 'Photo Lab backend URL',
    field: 'gcpUrl',
    requiredScope: null,
    required: false,
    usedFor: 'Reaching the restoration API on the GPU VM.',
    breaksWithout: 'Photo restoration is unavailable; album uploads still work.',
    generateAt: null,
  },
]

// Packages whose freshness the Vault checks against the npm registry.
export const TRACKED_SDKS = [
  { name: '@huggingface/hub', current: '2.15.0', purpose: 'HF deploy client' },
]

/**
 * Verify a Hugging Face token: is it valid, and does it carry write scope?
 * Returns { ok, user, role, scopes, canWrite, reason }.
 */
export async function verifyHfToken(token) {
  if (!token?.trim()) return { ok: false, reason: 'No token stored' }
  try {
    const res = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token.trim()}` },
    })
    if (!res.ok) {
      return { ok: false, reason: res.status === 401 ? 'Token rejected — expired or revoked' : `HTTP ${res.status}` }
    }
    const data = await res.json()
    const at = data?.auth?.accessToken ?? {}
    const role = at.role ?? null
    const fine = at.fineGrained ?? null

    // Fine-grained tokens list permissions per-scope; classic tokens use `role`.
    let scopes = []
    if (fine) {
      const all = [...(fine.global ?? []), ...(fine.scoped ?? []).flatMap((s) => s.permissions ?? [])]
      scopes = [...new Set(all)]
    } else if (role) {
      scopes = [role]
    }

    const canWrite =
      role === 'write' ||
      role === 'admin' ||
      scopes.some((s) => /write|repo\.content\.write|repo\.write/i.test(s))

    return {
      ok: true,
      user: data.name ?? data.fullname ?? null,
      role,
      scopes,
      canWrite,
      tokenName: at.displayName ?? null,
    }
  } catch (e) {
    return { ok: false, reason: e.message || 'Network error' }
  }
}

/**
 * Check tracked SDKs against the npm registry. Runs against today's date so
 * the Vault can say when it last looked, not just what it found.
 */
export async function checkSdkFreshness() {
  const checkedAt = new Date()
  const results = await Promise.all(
    TRACKED_SDKS.map(async (sdk) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${sdk.name}/latest`, {
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) return { ...sdk, status: 'unknown', reason: `HTTP ${res.status}` }
        const data = await res.json()
        const latest = data.version
        return {
          ...sdk,
          latest,
          status: latest === sdk.current ? 'current' : 'outdated',
          publishedAt: data.time ?? null,
        }
      } catch (e) {
        return { ...sdk, status: 'unknown', reason: e.message || 'offline' }
      }
    }),
  )
  return { checkedAt, results }
}
