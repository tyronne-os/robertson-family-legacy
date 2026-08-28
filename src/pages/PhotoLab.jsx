import { useState, useCallback, useRef, useEffect } from 'react'
import NavBar from '../components/NavBar.jsx'
import { fileToBase64, restorePhoto, checkBackendHealth } from '../lib/gcpRestore.js'
import { uploadToAlbum } from '../lib/hfStorage.js'

const DARK     = '#0B0705'
const MAHOGANY = '#26150A'
const PANEL    = '#140C07'
const GOLD     = '#C9A227'
const AMBER    = '#F0D98C'
const CREAM    = '#E8D7B6'
const DIM      = 'rgba(232,215,182,.45)'

const inp     = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 3, border: '1px solid rgba(201,162,39,.32)', background: 'rgba(11,7,5,.6)', color: CREAM, fontFamily: "'EB Garamond',Georgia,serif", fontSize: 15, outline: 'none' }
const btnGold  = { fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.26em', padding: '10px 22px', borderRadius: 2, cursor: 'pointer', border: 'none', background: GOLD, color: DARK, fontWeight: 700 }
const btnGhost = { fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.26em', padding: '10px 22px', borderRadius: 2, cursor: 'pointer', border: `1px solid rgba(201,162,39,.45)`, background: 'transparent', color: AMBER }
const sLabel   = { fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.34em', color: GOLD, marginBottom: 12, display: 'block' }
const panelBox = { background: MAHOGANY, border: `1px solid rgba(201,162,39,.2)`, borderRadius: 4, padding: '20px 22px' }

function Spinner({ label }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,7,5,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(201,162,39,.2)', borderTopColor: GOLD, animation: 'spin 1s linear infinite', marginBottom: 14 }} />
      <p style={{ fontSize: 14, color: DIM, fontFamily: "'EB Garamond',Georgia,serif", fontStyle: 'italic' }}>{label}</p>
    </div>
  )
}

export default function PhotoLab() {
  const [health, setHealth]       = useState(null)
  const [original, setOriginal]   = useState(null)
  const [restored, setRestored]   = useState(null)
  const [stage, setStage]         = useState('idle')
  const [errorMsg, setErrorMsg]   = useState('')
  const [sliderX, setSliderX]     = useState(50)
  const [caption, setCaption]     = useState('')
  const [savedMsg, setSavedMsg]   = useState('')
  const [recent, setRecent]       = useState([])
  const dragging = useRef(false)
  const compareRef = useRef(null)

  useEffect(() => { checkBackendHealth().then(setHealth) }, [])

  const handleFile = useCallback(async (file) => {
    if (!file?.type?.startsWith('image/')) return
    setOriginal(await fileToBase64(file))
    setRestored(null); setStage('idle'); setCaption(file.name ?? '')
  }, [])

  const onDrop  = useCallback((e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }, [handleFile])
  const onInput = useCallback((e) => { handleFile(e.target.files[0]) }, [handleFile])

  const handleRestore = useCallback(async () => {
    if (!original) return
    setStage('loading'); setErrorMsg('')
    try { const r = await restorePhoto(original); setRestored(r); setStage('compare') }
    catch (e) { setErrorMsg(e.message); setStage('error') }
  }, [original])

  const handleAddToAlbum = useCallback(async () => {
    const src = restored ?? original; if (!src) return
    setStage('uploading')
    try {
      const blob = await fetch(src).then(r => r.blob())
      const f = new File([blob], caption || 'restored.jpg', { type: 'image/jpeg' })
      await uploadToAlbum(f, { caption })
      setRecent(p => [{ original, restored, name: caption }, ...p.slice(0, 19)])
      setSavedMsg('Added to Album ✓'); setStage('idle'); setTimeout(() => setSavedMsg(''), 3000)
    } catch (e) { setErrorMsg(e.message); setStage('error') }
  }, [restored, original, caption])

  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !compareRef.current) return
    const rect = compareRef.current.getBoundingClientRect()
    setSliderX(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
  }, [])

  const busy = ['loading','uploading'].includes(stage)
  const spinLabel = { loading: 'Restoring photo…', uploading: 'Adding to album…' }[stage]

  return (
    <div
      style={{ background: DARK, color: CREAM, minHeight: '100vh', fontFamily: "'EB Garamond',Georgia,serif", paddingBottom: 60 }}
      onMouseMove={onMouseMove}
      onMouseUp={() => { dragging.current = false }}
    >
      <NavBar active="photo-lab" tagline="The Robertson Photo Lab" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 0' }}>

        {/* Backend status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: '.32em', color: GOLD }}>GPU BACKEND</span>
          {!health && <span style={{ fontSize: 13, color: DIM }}>Checking…</span>}
          {health?.ok === true  && <span style={{ fontSize: 13, color: '#7DCF7D' }}>● Online — restoration pipeline ready</span>}
          {health?.ok === false && <span style={{ fontSize: 13, color: '#E87070' }}>● Offline — {health.reason}</span>}
        </div>

        {/* Dual pane */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Drop zone — original */}
          <div
            onDrop={onDrop} onDragOver={e => e.preventDefault()}
            onClick={() => document.getElementById('lab-file-in').click()}
            style={{ background: PANEL, border: `1px dashed rgba(201,162,39,${original ? '.28' : '.5'})`, borderRadius: 4, minHeight: 360, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            {original
              ? <img src={original} alt="original" style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0 }} />
              : <div style={{ textAlign: 'center', padding: 32, opacity: .45 }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>⊕</div>
                  <p style={{ ...sLabel, marginBottom: 6 }}>DRAG & DROP</p>
                  <p style={{ fontSize: 15, color: DIM }}>or click to select a vintage photo</p>
                </div>
            }
            <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(11,7,5,.7)', color: CREAM, fontSize: 10, letterSpacing: '.2em', padding: '3px 8px', borderRadius: 2 }}>ORIGINAL</div>
            <input id="lab-file-in" type="file" accept="image/*" style={{ display: 'none' }} onChange={onInput} />
          </div>

          {/* Restored / before-after compare */}
          <div
            ref={compareRef}
            style={{ background: PANEL, border: `1px solid rgba(201,162,39,.22)`, borderRadius: 4, minHeight: 360, position: 'relative', overflow: 'hidden', cursor: restored ? 'col-resize' : 'default', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseDown={() => { if (restored) dragging.current = true }}
          >
            {restored
              ? <>
                  <img src={restored} alt="restored" style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0 }} />
                  {original && <>
                    <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}>
                      <img src={original} alt="before" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderX}%`, width: 2, background: GOLD, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 26, height: 26, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: DARK, fontWeight: 700 }}>⇆</div>
                    </div>
                    <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(11,7,5,.7)', color: CREAM, fontSize: 10, letterSpacing: '.2em', padding: '3px 8px', borderRadius: 2 }}>BEFORE</div>
                  </>}
                  <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(201,162,39,.22)', color: AMBER, fontSize: 10, letterSpacing: '.2em', padding: '3px 8px', borderRadius: 2 }}>RESTORED</div>
                  {!busy && <a href={restored} download="restored.jpg" style={{ position: 'absolute', bottom: 10, right: 10, ...btnGold, fontSize: 10, padding: '7px 14px', textDecoration: 'none' }}>↓ SAVE</a>}
                </>
              : <div style={{ textAlign: 'center', opacity: .28 }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>✦</div>
                  <p style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.22em' }}>RESTORED OUTPUT</p>
                </div>
            }
            {busy && <Spinner label={spinLabel} />}
          </div>
        </div>

        {/* Restore action */}
        <div style={{ ...panelBox, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <span style={sLabel}>AUTOMATIC RESTORATION</span>
            <p style={{ fontSize: 14, color: DIM, margin: 0 }}>Repairs scratches and noise, then sharpens faces — no prompt needed.</p>
          </div>
          <button style={{ ...btnGold, opacity: (!original || busy) ? .5 : 1, flexShrink: 0 }} onClick={handleRestore} disabled={!original || busy}>
            RESTORE
          </button>
          {errorMsg && <p style={{ color: '#E87070', fontSize: 14, margin: 0 }}>{errorMsg}</p>}
        </div>

        {/* Caption + Add to Album */}
        {(original || restored) && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 28 }}>
            <input placeholder="Caption for the family album…" value={caption} onChange={e => setCaption(e.target.value)} style={{ ...inp, flex: 1 }} />
            <button style={{ ...btnGold, opacity: busy ? .6 : 1 }} onClick={handleAddToAlbum} disabled={busy}>
              {savedMsg || (busy ? 'Adding…' : 'Add to Album')}
            </button>
          </div>
        )}

        {/* Recent session strip */}
        {recent.length > 0 && (
          <div>
            <span style={sLabel}>RECENT SESSION</span>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
              {recent.map((r, i) => (
                <div key={i}
                  style={{ flex: '0 0 130px', cursor: 'pointer', border: '1px solid rgba(201,162,39,.22)', borderRadius: 3, overflow: 'hidden' }}
                  onClick={() => { setOriginal(r.original); setRestored(r.restored); setCaption(r.name); setStage(r.restored ? 'compare' : 'idle') }}
                >
                  <img src={r.restored ?? r.original} alt={r.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '5px 8px', fontSize: 11, color: DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
