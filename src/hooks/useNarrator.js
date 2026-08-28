import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { synthesize } from '../lib/kokoro.js'
import { fullChapterText } from '../data/chapters.js'
import { subscribe, getAudioSettings, toggleMuted } from '../lib/audioSettings.js'

const VOICE_STORAGE_KEY = 'robertson-legacy:narrator-voice'

// Every Kokoro voice below is female: `af_` = American Female, `bf_` = British
// Female. Eight to choose from; the chapter picks its own default.
export const VOICES = [
  { id: 'af_heart', name: 'HEART', desc: 'warm & maternal — American' },
  { id: 'af_bella', name: 'BELLA', desc: 'rich & unhurried — American' },
  { id: 'af_nicole', name: 'NICOLE', desc: 'soft, close-mic — American' },
  { id: 'af_sarah', name: 'SARAH', desc: 'clear & steady — American' },
  { id: 'af_nova', name: 'NOVA', desc: 'bright & lively — American' },
  { id: 'af_sky', name: 'SKY', desc: 'light & airy — American' },
  { id: 'bf_emma', name: 'EMMA', desc: 'poised & literary — British' },
  { id: 'bf_isabella', name: 'ISABELLA', desc: 'stately & mature — British' },
]

/** Pre-rendered narration, written by `npm run narrate`. */
function prerenderedUrl(chapterId, voiceId) {
  return `./audio/narration/ch${String(chapterId).padStart(2, '0')}-${voiceId}.wav`
}

async function hasPrerendered(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

function formatRemaining(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')} remaining`
}

export function useNarrator(chapter) {
  const audioRef = useRef(null)
  const [voice, setVoice] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem(VOICE_STORAGE_KEY)) || 'af_bella',
  )
  // idle | loading | playing | paused | blocked | error
  const [status, setStatus] = useState('idle')
  const [loadPct, setLoadPct] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const cacheRef = useRef({}) // voice -> object URL or static path, per chapter
  const autoTriedRef = useRef(null) // chapter id we've already auto-started

  const { muted, autoplay } = useSyncExternalStore(subscribe, getAudioSettings, getAudioSettings)

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
  }

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setRemaining(formatRemaining(el.duration - el.currentTime))
    const onEnd = () => setStatus('paused')
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnd)
    }
  }, [])

  // Global mute stops audio immediately, everywhere.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.muted = muted
    if (muted && !el.paused) {
      el.pause()
      setStatus('paused')
    }
  }, [muted])

  // A new chapter invalidates cached narration.
  useEffect(() => {
    cacheRef.current = {}
    setStatus('idle')
    setRemaining(null)
    setErrorMsg('')
  }, [chapter?.id])

  const play = useCallback((url) => {
    const el = audioRef.current
    el.src = url
    el.muted = getAudioSettings().muted
    el.play()
      .then(() => setStatus('playing'))
      .catch(() => {
        // Autoplay policy blocked us — say so instead of failing silently.
        setStatus('blocked')
      })
  }, [])

  const start = useCallback(
    async (voiceOverride) => {
      if (!chapter) return
      if (getAudioSettings().muted) return
      const v = voiceOverride ?? voice

      const cached = cacheRef.current[v]
      if (cached) {
        play(cached)
        return
      }

      setStatus('loading')
      setLoadPct(0)
      setErrorMsg('')

      // Prefer a pre-rendered file: instant, no model download, no GPU.
      const staticUrl = prerenderedUrl(chapter.id, v)
      if (await hasPrerendered(staticUrl)) {
        cacheRef.current[v] = staticUrl
        play(staticUrl)
        return
      }

      // Fall back to synthesizing in-browser.
      try {
        const url = await synthesize(fullChapterText(chapter), v, (p) => {
          if (p?.status === 'progress' && p.total) {
            setLoadPct(Math.round((p.loaded / p.total) * 100))
          }
        })
        cacheRef.current[v] = url
        play(url)
      } catch (err) {
        console.error('Kokoro narration failed', err)
        setErrorMsg(
          err?.message?.includes('fetch') || err?.name === 'TypeError'
            ? 'Could not download the voice model — check your connection.'
            : 'The narrator failed to load. Tap to try again.',
        )
        setStatus('error')
      }
    },
    [chapter, voice, play],
  )

  // Auto-start on chapter load, unless muted or already tried for this chapter.
  useEffect(() => {
    if (!chapter || muted || !autoplay) return
    if (autoTriedRef.current === chapter.id) return
    autoTriedRef.current = chapter.id
    start()
  }, [chapter, muted, autoplay, start])

  const toggle = useCallback(() => {
    const el = audioRef.current
    if (status === 'playing') {
      el.pause()
      setStatus('paused')
    } else if ((status === 'paused' || status === 'blocked') && el.src) {
      el.muted = getAudioSettings().muted
      el.play().then(() => setStatus('playing')).catch(() => setStatus('blocked'))
    } else {
      start()
    }
  }, [status, start])

  const selectVoice = useCallback(
    (id) => {
      setVoice(id)
      if (typeof localStorage !== 'undefined') localStorage.setItem(VOICE_STORAGE_KEY, id)
      const el = audioRef.current
      el.pause()
      setStatus('idle')
      setRemaining(null)
      const cached = cacheRef.current[id]
      if (cached) play(cached)
      else start(id)
    },
    [play, start],
  )

  return {
    status,
    loadPct,
    remaining,
    errorMsg,
    voice,
    voices: VOICES,
    muted,
    toggleMuted,
    start,
    toggle,
    selectVoice,
  }
}
