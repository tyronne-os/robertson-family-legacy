/**
 * Hugging Face Dataset storage engine for the Robertson Family Album.
 * All approved photos are stored permanently in a HF Dataset repo so they
 * survive Space restarts and are accessible across sessions.
 *
 * Env vars (set in .env or the Vault settings panel):
 *   VITE_HF_ACCESS_TOKEN   — HF token with write access
 *   VITE_HF_DATASET_REPO   — e.g. "AIBRUH/robertson-family-album-storage"
 */

import { uploadFiles, listFiles } from '@huggingface/hub'

const REPO = import.meta.env.VITE_HF_DATASET_REPO ?? 'AIBRUH/robertson-family-album-storage'

function getToken() {
  return (
    import.meta.env.VITE_HF_ACCESS_TOKEN ||
    localStorage.getItem('robertson-legacy:hf-token') ||
    ''
  )
}

function credentials() {
  return { accessToken: getToken() }
}

/**
 * Upload one photo to the HF Dataset and return its permanent CDN URL.
 *
 * @param {File|Blob} file   — the image file
 * @param {{ chapter?: string, caption?: string, uploadedBy?: string }} metadata
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function uploadToAlbum(file, metadata = {}) {
  const ext = file.name?.split('.').pop() ?? 'jpg'
  const ts = Date.now()
  const safeName = (file.name ?? 'photo')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.+/g, '.')
    .slice(0, 80)
  const path = `photos/${ts}-${safeName}`

  // Upload the image
  await uploadFiles({
    repo: { type: 'dataset', name: REPO },
    credentials: credentials(),
    files: [{ path, content: file }],
    commitTitle: `Add family photo: ${safeName}`,
  })

  // Write a sidecar metadata JSON
  const meta = {
    path,
    chapter: metadata.chapter ?? null,
    caption: metadata.caption ?? '',
    uploadedBy: metadata.uploadedBy ?? 'family',
    uploadedAt: new Date().toISOString(),
    originalName: file.name ?? safeName,
  }
  const metaPath = `photos/${ts}-${safeName}.meta.json`
  await uploadFiles({
    repo: { type: 'dataset', name: REPO },
    credentials: credentials(),
    files: [
      {
        path: metaPath,
        content: new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }),
      },
    ],
    commitTitle: `Add metadata for ${safeName}`,
  })

  const url = `https://huggingface.co/datasets/${REPO}/resolve/main/${path}`
  return { url, path }
}

/**
 * Fetch all photos from the HF Dataset, newest first.
 * Returns an array of { url, path, meta } objects.
 *
 * @returns {Promise<Array<{ url: string, path: string, meta: object }>>}
 */
export async function fetchAlbumPhotos() {
  try {
    const files = []
    for await (const entry of listFiles({
      repo: { type: 'dataset', name: REPO },
      credentials: credentials(),
      path: 'photos',
    })) {
      if (entry.type === 'file' && !entry.path.endsWith('.meta.json')) {
        files.push(entry)
      }
    }

    // Sort newest first (path prefix is a timestamp)
    files.sort((a, b) => b.path.localeCompare(a.path))

    return files.map((f) => ({
      url: `https://huggingface.co/datasets/${REPO}/resolve/main/${f.path}`,
      path: f.path,
      meta: {},
    }))
  } catch {
    return []
  }
}
