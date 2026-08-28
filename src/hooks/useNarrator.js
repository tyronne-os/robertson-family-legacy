import { useCallback, useEffect, useRef, useState } from 'react'
import { synthesize } from '../lib/kokoro.js'
import { fullChapterText } from '../data/chapters.js'

const VOICE_STORAGE_KEY = 'robertson-legacy:narrator-voice'

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
  const [status, setStatus] = useState('idle') // idle | loading | playing | paused
  const [loadPct, setLoadPct] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const cacheRef = useRef({}) // voice -> object URL, invalidated per chapter

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

  // A new chapter invalidates any cached narration audio.
  useEffect(() => {
    cacheRef.current = {}
    setStatus('idle')
    setRemaining(null)
  }, [chapter?.id])

  const play = useCallback((url) => {
    const el = audioRef.current
    el.src = url
    el.play()
      .then(() => setStatus('playing'))
      .catch(() => setStatus('paused')) // autoplay blocked — user taps to resume
  }, [])

  const start = useCallback(
    async (voiceOverride) => {
      if (!chapter) return
      const v = voiceOverride ?? voice
      const cached = cacheRef.current[v]
      if (cached) {
        play(cached)
        return
      }
      setStatus('loading')
      setLoadPct(0)
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
        setStatus('idle')
      }
    },
    [chapter, voice, play],
  )

  const toggle = useCallback(() => {
    const el = audioRef.current
    if (status === 'playing') {
      el.pause()
      setStatus('paused')
    } else if (status === 'paused' && el.src) {
      el.play().then(() => setStatus('playing')).catch(() => {})
    } else if (status === 'idle') {
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

  return { status, loadPct, remaining, voice, voices: VOICES, start, toggle, selectVoice }
}
