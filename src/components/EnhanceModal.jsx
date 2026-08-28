import { useState, useRef, useCallback } from 'react'
import { fileToBase64, restorePhoto } from '../lib/gcpRestore.js'
import { uploadToAlbum } from '../lib/hfStorage.js'

const GOLD = '#C9A227'
const CREAM = '#E8D7B6'
const DARK = '#0B0705'
const AMBER = '#F0D98C'

export default function EnhanceModal({ file, onClose, onAddedToAlbum }) {
  const [stage, setStage] = useState('ask')        // ask | loading | compare | uploading | done | error
  const [original, setOriginal] = useState(null)
  const [restored, setRestored] = useState(null)
  const [sliderX, setSliderX] = useState(50)
  const [errorMsg, setErrorMsg] = useState('')
  const [caption, setCaption] = useState('')
  const [chapter, setChapter] = useState('')
  const containerRef = useRef(null)
  const dragging = useRef(false)

  const handleRestore = useCallback(async () => {
    setStage('loading')
    try {
      const b64 = await fileToBase64(file)
      setOriginal(b64)
      const result = await restorePhoto(b64)
      setRestored(result)
      setStage('compare')
    } catch (e) {
      setErrorMsg(e.message)
      setStage('error')
    }
  }, [file])

  const handleSkipRestore = useCallback(async () => {
    setStage('uploading')
    try {
      const b64 = await fileToBase64(file)
      setOriginal(b64)
      const { url } = await uploadToAlbum(file, { caption, chapter })
      onAddedToAlbum?.({ url, caption, chapter, file })
      setStage('done')
    } catch (e) {
      setErrorMsg(e.message)
      setStage('error')
    }
  }, [file, caption, chapter, onAddedToAlbum])

  const handleApprove = useCallback(async () => {
    setStage('uploading')
    try {
      const blob = await fetch(restored).then((r) => r.blob())
      const f = new File([blob], file.name ?? 'restored.jpg', { type: 'image/jpeg' })
      const { url } = await uploadToAlbum(f, { caption, chapter })
      onAddedToAlbum?.({ url, caption, chapter, file })
      setStage('done')
    } catch (e) {
      setErrorMsg(e.message)
      setStage('error')
    }
  }, [restored, file, caption, chapter, onAddedToAlbum])

  const handleKeepOriginal = useCallback(async () => {
    setStage('uploading')
    try {
      const { url } = await uploadToAlbum(file, { caption, chapter })
      onAddedToAlbum?.({ url, caption, chapter, file })
      setStage('done')
    } catch (e) {
      setErrorMsg(e.message)
      setStage('error')
    }
  }, [file, caption, chapter, onAddedToAlbum])

  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    setSliderX(pct)
  }, [])

  const panel = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(11,7,5,.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  }
  const card = {
    background: '#140C07',
    border: `1px solid rgba(201,162,39,.35)`,
    borderRadius: 6,
    padding: '36px 40px',
    maxWidth: 680,
    width: '100%',
    color: CREAM,
    fontFamily: "'EB Garamond',Georgia,serif",
    boxShadow: '0 40px 80px rgba(0,0,0,.8)',
    maxHeight: '90vh',
    overflowY: 'auto',
  }
  const btnBase = {
    fontFamily: "'Cinzel',serif",
    fontSize: 12,
    letterSpacing: '.28em',
    padding: '12px 28px',
    borderRadius: 2,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity .2s',
  }
  const btnGold = { ...btnBase, background: GOLD, color: DARK, fontWeight: 700 }
  const btnGhost = { ...btnBase, background: 'transparent', border: `1px solid rgba(201,162,39,.5)`, color: AMBER }

  return (
    <div style={panel} onMouseMove={onMouseMove} onMouseUp={() => { dragging.current = false }}>
      <div style={card}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.38em', color: GOLD, marginBottom: 8 }}>
          ROBERTSON FAMILY ALBUM
        </div>

        {/* ── ASK ────────────────────────────────────────────── */}
        {stage === 'ask' && (
          <>
            <h2 style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 36, color: CREAM, margin: '0 0 14px', lineHeight: 1.1 }}>
              Restore this memory?
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(232,215,182,.8)', marginBottom: 20 }}>
              Would you like our AI to restore this historic photo before placing it in the family album —
              repairing scratches, sharpening faces, and reviving the original warmth?
            </p>
            {file && (
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 4, marginBottom: 20, border: '1px solid rgba(201,162,39,.2)' }}
              />
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={btnGold} onClick={handleRestore}>Yes — Restore It</button>
              <button style={btnGhost} onClick={handleSkipRestore}>No — Add As-Is</button>
              <button style={{ ...btnGhost, marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {/* ── LOADING ─────────────────────────────────────────── */}
        {(stage === 'loading' || stage === 'uploading') && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid rgba(201,162,39,.2)`, borderTopColor: GOLD, animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ fontSize: 16, color: 'rgba(232,215,182,.7)' }}>
              {stage === 'loading' && 'Restoring the photo…'}
              {stage === 'uploading' && 'Adding to the family album…'}
            </p>
          </div>
        )}

        {/* ── COMPARE ─────────────────────────────────────────── */}
        {stage === 'compare' && (
          <>
            <h2 style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 32, color: CREAM, margin: '0 0 14px' }}>
              Before & After
            </h2>

            {/* Split slider */}
            <div
              ref={containerRef}
              style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: 4, border: '1px solid rgba(201,162,39,.25)', marginBottom: 16, cursor: 'col-resize', userSelect: 'none' }}
              onMouseDown={() => { dragging.current = true }}
            >
              <img src={restored} alt="restored" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}>
                <img src={original} alt="original" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderX}%`, width: 2, background: GOLD, transform: 'translateX(-50%)' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: DARK, fontWeight: 700 }}>⇆</div>
              </div>
              <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(11,7,5,.7)', color: CREAM, fontSize: 10, letterSpacing: '.2em', padding: '3px 8px', borderRadius: 2 }}>ORIGINAL</div>
              <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(201,162,39,.25)', color: AMBER, fontSize: 10, letterSpacing: '.2em', padding: '3px 8px', borderRadius: 2 }}>RESTORED</div>
            </div>

            {/* Caption / chapter inputs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                placeholder="Caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={{ flex: 2, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,162,39,.3)', color: CREAM, borderRadius: 2, padding: '8px 12px', fontSize: 14, fontFamily: "'EB Garamond',Georgia,serif" }}
              />
              <input
                placeholder="Chapter (optional)"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,162,39,.3)', color: CREAM, borderRadius: 2, padding: '8px 12px', fontSize: 14, fontFamily: "'EB Garamond',Georgia,serif" }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button style={btnGold} onClick={handleApprove}>Approve & Add to Album</button>
              <button style={btnGhost} onClick={handleKeepOriginal}>Keep Original</button>
              <button style={{ ...btnGhost, marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {/* ── DONE ────────────────────────────────────────────── */}
        {stage === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
            <p style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: '.3em', color: GOLD, marginBottom: 8 }}>ADDED TO THE FAMILY ALBUM</p>
            <p style={{ fontSize: 16, color: 'rgba(232,215,182,.7)', marginBottom: 24 }}>This memory is now preserved in the Robertson Family Archive.</p>
            <button style={btnGold} onClick={onClose}>Close</button>
          </div>
        )}

        {/* ── ERROR ───────────────────────────────────────────── */}
        {stage === 'error' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ color: '#E87070', marginBottom: 16, fontSize: 15 }}>{errorMsg}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={btnGold} onClick={() => setStage('ask')}>Try Again</button>
              <button style={btnGhost} onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
