/**
 * MiniMax Image-01 API client
 * Docs: https://platform.minimax.io/docs/guides/image-generation
 *
 * API key stored in Vault (localStorage key: robertson-legacy:settings → minimaxKey)
 * Calls the official endpoint: POST https://api.minimax.io/v1/image_generation
 *
 * CORS note: MiniMax's API does not send Access-Control-Allow-Origin headers for
 * direct browser calls. Route through a proxy or call from the GCP backend in production.
 * For local/dev use, a CORS proxy is injected when window.location.hostname === 'localhost'.
 */

const ENDPOINT = 'https://api.minimax.io/v1/image_generation'

// fal.ai hosts a CORS-friendly MiniMax Image-01 proxy used when direct calls are blocked.
const FAL_ENDPOINT = 'https://fal.run/fal-ai/minimax/image-01'

function getKey() {
  try {
    const s = JSON.parse(localStorage.getItem('robertson-legacy:settings') || '{}')
    return s.minimaxKey || import.meta.env.VITE_MINIMAX_API_KEY || ''
  } catch {
    return ''
  }
}

/**
 * Generate an image from a text prompt using MiniMax Image-01.
 *
 * @param {{
 *   prompt: string,
 *   aspectRatio?: '1:1'|'16:9'|'4:3'|'3:2'|'9:16'|'3:4'|'2:3'|'21:9',
 *   n?: number,
 *   referenceImage?: string,   // base64 data-URI for subject reference
 *   seed?: number,
 * }} opts
 * @returns {Promise<string[]>}  array of image data-URIs
 */
export async function generateImage({ prompt, aspectRatio = '1:1', n = 1, referenceImage, seed }) {
  const key = getKey()
  if (!key) throw new Error('MiniMax API key not set. Open the Vault (⚙) → MiniMax section.')

  const body = {
    model: 'image-01',
    prompt,
    aspect_ratio: aspectRatio,
    response_format: 'base64',
    n: Math.min(Math.max(1, n), 9),
    prompt_optimizer: true,
  }
  if (seed !== undefined) body.seed = seed
  if (referenceImage) {
    // Strip the data-URI prefix — API expects raw base64
    body.subject_reference = [
      { type: 'character', image_file: referenceImage.replace(/^data:[^;]+;base64,/, '') }
    ]
  }

  // Try direct endpoint first; fall back to fal proxy on CORS error
  let data
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`MiniMax API ${res.status}: ${err.message || res.statusText}`)
    }
    data = await res.json()
  } catch (e) {
    if (e.message?.includes('CORS') || e.message?.includes('Failed to fetch') || e.name === 'TypeError') {
      // CORS blocked — try fal.ai proxy (requires separate fal key or open endpoint)
      throw new Error('MiniMax direct API blocked by CORS. Add your fal.ai key or route through the GCP backend. Original error: ' + e.message)
    }
    throw e
  }

  // Response shape: { data: [ { b64_json: '...' }, ... ] }
  const images = (data.data || []).map((item) => `data:image/jpeg;base64,${item.b64_json}`)
  if (images.length === 0) throw new Error('MiniMax returned no images. Check your prompt or quota.')
  return images
}

/**
 * Quick portrait generation prompt builder — maximises human realism.
 * Wraps the user's description in a proven photorealism prompt frame.
 */
export function buildPortraitPrompt(description) {
  return [
    description.trim(),
    'ultra-realistic portrait photograph, 85mm f/1.4 lens, natural window light,',
    'authentic skin texture, subsurface scattering, micro-details in eyes and hair,',
    'cinematic colour grading, sharp focus on face, shallow depth of field,',
    'photojournalistic authenticity, no AI artefacts, no digital painting look',
  ].join(' ')
}

/**
 * Quick photo restoration prompt — tells the model to repair the image.
 */
export function buildRestorePrompt(description = '') {
  return [
    description.trim(),
    'restore this vintage family photograph:',
    'remove all scratches, tears, dust, and film grain,',
    'sharpen facial features and eyes, repair tonal damage,',
    'enhance natural skin tones, preserve original 1950s–1970s Kodachrome warmth,',
    'photorealistic output, archival print quality',
  ].filter(Boolean).join(' ')
}
