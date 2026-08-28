// Global audio preferences — one source of truth for every page.
//
// Mute is deliberately global and persisted: silencing the narrator on one
// chapter silences ambient jazz and every other chapter too, and it survives
// a reload. Nothing should ever start making noise after the user said stop.

const MUTE_KEY = 'robertson-legacy:muted'
const AUTOPLAY_KEY = 'robertson-legacy:autoplay'

const listeners = new Set()

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch {
    return fallback
  }
}

let state = {
  // Default: sound on, narration auto-starts. The user opts out, not in.
  muted: read(MUTE_KEY, false),
  autoplay: read(AUTOPLAY_KEY, true),
}

function emit() {
  for (const fn of listeners) fn()
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getAudioSettings() {
  return state
}

export function setMuted(muted) {
  if (state.muted === muted) return
  state = { ...state, muted }
  try { localStorage.setItem(MUTE_KEY, String(muted)) } catch { /* private mode */ }
  emit()
}

export function toggleMuted() {
  setMuted(!state.muted)
}

export function setAutoplay(autoplay) {
  if (state.autoplay === autoplay) return
  state = { ...state, autoplay }
  try { localStorage.setItem(AUTOPLAY_KEY, String(autoplay)) } catch { /* private mode */ }
  emit()
}

// Cross-tab sync — muting in one tab mutes them all.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === MUTE_KEY || e.key === AUTOPLAY_KEY) {
      state = { muted: read(MUTE_KEY, false), autoplay: read(AUTOPLAY_KEY, true) }
      emit()
    }
  })
}
