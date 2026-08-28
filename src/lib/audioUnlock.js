// Playing (and immediately pausing) any audio element synchronously inside a
// real click handler grants the page "user activation" for audio playback,
// so a later async play() call (e.g. after TTS generation finishes) is far
// less likely to be blocked by browser autoplay policy.
export function unlockAudio() {
  try {
    const el = new Audio('./audio/silence.wav')
    el.play().then(() => el.pause()).catch(() => {})
  } catch {
    // ignore — best-effort only
  }
}
