import { useMemo, useRef, useState } from 'react'
import NavBar from '../components/NavBar.jsx'
import EnhanceModal from '../components/EnhanceModal.jsx'
import { chapterFilters, seedPhotos } from '../data/photos.js'

function photoKey(p) {
  return `${p.subject}-${p.slot}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export default function PhotoAlbum() {
  const [filter, setFilter] = useState('All')
  const [uploads, setUploads] = useState([])
  const [open, setOpen] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [threads, setThreads] = useState({})
  const [draft, setDraft] = useState('')
  const [parlorMessages, setParlorMessages] = useState([
    { who: 'Gloria W.', time: '4:12 pm', text: 'Found Mama’s Easter photos from 1968 — adding them tonight.' },
    { who: 'Arelita G.', time: '4:20 pm', text: 'Please do. I only have the one from the kitchen.' },
    { who: 'Tyronne', time: '4:31 pm', text: 'Anything you upload lands in the vault, full size. Nothing gets compressed.' },
  ])
  const fileInputRef = useRef(null)

  const allPhotos = useMemo(() => {
    const uploaded = uploads.map((u) => ({ subject: u.subject, by: 'You', image: u.url, slot: '' }))
    return [...uploaded, ...seedPhotos]
  }, [uploads])

  const visible = useMemo(
    () =>
      filter === 'All'
        ? allPhotos
        : allPhotos.filter((p) => p.subject.toLowerCase().includes(filter.toLowerCase())),
    [allPhotos, filter],
  )

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) setPendingFile(file)
    e.target.value = ''
  }

  const handleAddedToAlbum = ({ url, caption, chapter }) => {
    const subject = chapter || filter !== 'All' ? (chapter || filter) : 'Family'
    setUploads((prev) => [{ url, subject, by: 'You' }, ...prev])
    setPendingFile(null)
  }

  const send = () => {
    const text = draft.trim()
    if (!text) return
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
    const msg = { who: 'You', time, text, mine: true }
    if (open) {
      const key = photoKey(open)
      setThreads((prev) => ({ ...prev, [key]: [...(prev[key] || []), msg] }))
    } else {
      setParlorMessages((prev) => [...prev, msg])
    }
    setDraft('')
  }

  const openThread = open ? threads[photoKey(open)] || [] : []

  return (
    <div style={{ fontFamily: "'EB Garamond',Georgia,serif", background: '#0B0705', color: '#E8D7B6', minHeight: '100vh', boxSizing: 'border-box', padding: '0 0 40px' }}>
      <NavBar active="photos" />

      <div style={{ padding: '0 3vw' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 26 }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 'clamp(24px,3.2vw,46px)', letterSpacing: '.05em', color: '#F0D98C', textShadow: '0 3px 0 #8A6A1F,0 8px 22px rgba(0,0,0,.85)' }}>
              THE PHOTO ALBUM
            </div>
          </div>
          <label
            style={{
              cursor: 'pointer',
              padding: '14px 30px',
              border: '1px solid #8A6A1F',
              borderRadius: 2,
              fontFamily: "'Cinzel',serif",
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '.28em',
              color: '#2A1C14',
              background: 'linear-gradient(180deg,#E8C55C,#C9A227)',
              boxShadow: '0 8px 20px rgba(60,40,10,.35)',
            }}
          >
            ADD PHOTOS
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
          {chapterFilters.map((c) => (
            <div
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: '9px 16px',
                borderRadius: 2,
                cursor: 'pointer',
                fontFamily: "'Cinzel',serif",
                fontSize: 11.5,
                letterSpacing: '.22em',
                border: c === filter ? '1px solid rgba(232,197,92,.8)' : '1px solid rgba(201,162,39,.28)',
                color: c === filter ? '#F0D98C' : 'rgba(232,215,182,.6)',
                background: c === filter ? 'rgba(240,217,140,.12)' : 'transparent',
              }}
            >
              {c.toUpperCase()}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 26, marginTop: 24, alignItems: 'start' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 16,
            }}
          >
            {visible.map((p, i) => (
              <div
                key={photoKey(p) + i}
                onClick={() => setOpen(p)}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: 'linear-gradient(150deg,#4A2E16,#26150A 60%,#3C2412)',
                  padding: 10,
                  boxShadow: '0 14px 30px rgba(0,0,0,.55),inset 0 0 0 1px rgba(232,197,92,.4)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '4/3',
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: '#120B07',
                    backgroundImage: p.image ? `url('${p.image}')` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {!p.image && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: 14,
                        boxSizing: 'border-box',
                        backgroundImage: 'repeating-linear-gradient(135deg,rgba(232,197,92,.07) 0 8px,rgba(0,0,0,0) 8px 16px)',
                      }}
                    >
                      <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, letterSpacing: '.12em', color: 'rgba(232,215,182,.5)', lineHeight: 1.7 }}>
                        {p.slot}
                        {'\n'}drop a photo here
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 9 }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11.5, letterSpacing: '.14em', color: '#F0D98C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.subject}
                  </div>
                  <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 13, color: 'rgba(232,215,182,.5)', whiteSpace: 'nowrap' }}>
                    {p.by}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* The Parlor */}
          <div
            style={{
              position: 'sticky',
              top: 18,
              display: 'flex',
              flexDirection: 'column',
              height: 'min(760px, 80vh)',
              borderRadius: 6,
              overflow: 'hidden',
              background: 'linear-gradient(155deg,#241610,#150C07 60%,#1F130D)',
              boxShadow: '0 24px 54px rgba(0,0,0,.7),inset 0 0 0 1px rgba(201,162,39,.4)',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(201,162,39,.22)' }}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: '.28em', color: '#C9A227' }}>THE PARLOR</div>
              <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 14, color: 'rgba(232,215,182,.55)', marginTop: 2 }}>
                Family chat &middot; say hello
              </div>
            </div>
            <div className="vault-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {parlorMessages.map((m, i) => (
                <ParlorMessage key={i} m={m} />
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(201,162,39,.22)', padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                rows={2}
                placeholder="Share a memory&hellip;"
                value={open ? '' : draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{ flex: 1, padding: 10, fontSize: 16, color: '#F0D98C', background: 'rgba(240,217,140,.06)', border: '1px solid rgba(201,162,39,.4)', borderRadius: 2, outline: 'none', resize: 'none' }}
              />
              <div
                onClick={send}
                style={{ padding: '11px 18px', borderRadius: 2, cursor: 'pointer', fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.24em', color: '#2A1C14', background: 'linear-gradient(180deg,#E8C55C,#C9A227)' }}
              >
                SEND
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhance Modal */}
      {pendingFile && (
        <EnhanceModal
          file={pendingFile}
          onClose={() => setPendingFile(null)}
          onAddedToAlbum={handleAddedToAlbum}
        />
      )}

      {/* Lightbox */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 380px',
            gap: 22,
            padding: 28,
            boxSizing: 'border-box',
            background: 'rgba(8,5,3,.96)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, paddingBottom: 12, borderBottom: '1px solid rgba(201,162,39,.22)' }}>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, letterSpacing: '.2em', color: '#F0D98C' }}>{open.subject}</div>
                <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 15, color: 'rgba(232,215,182,.55)', marginTop: 2 }}>
                  Shared by {open.by}
                </div>
              </div>
              <div
                onClick={() => setOpen(null)}
                style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: '.26em', color: '#C9A227', cursor: 'pointer', border: '1px solid rgba(201,162,39,.35)', borderRadius: 2, padding: '9px 16px' }}
              >
                CLOSE &#10005;
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                marginTop: 16,
                padding: 14,
                boxSizing: 'border-box',
                borderRadius: 3,
                background: 'linear-gradient(150deg,#4A2E16,#26150A 60%,#3C2412)',
                boxShadow: 'inset 0 0 0 1px rgba(232,197,92,.45)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: '#120B07',
                  backgroundImage: open.image ? `url('${open.image}')` : 'none',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!open.image && (
                  <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 13, letterSpacing: '.12em', color: 'rgba(232,215,182,.5)', lineHeight: 1.9, textAlign: 'center', whiteSpace: 'pre-line' }}>
                    {open.slot}
                    {'\n'}awaiting a photo
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(155deg,#241610,#150C07 60%,#1F130D)', boxShadow: 'inset 0 0 0 1px rgba(201,162,39,.4)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(201,162,39,.22)' }}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: '.28em', color: '#C9A227' }}>ABOUT THIS PHOTO</div>
              <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 14, color: 'rgba(232,215,182,.55)', marginTop: 2 }}>
                Say something about this photo
              </div>
            </div>
            <div className="vault-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {openThread.length === 0 && (
                <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 15, color: 'rgba(232,215,182,.45)', lineHeight: 1.5 }}>
                  No one has spoken on this photograph yet. Be the first to tell its story.
                </div>
              )}
              {openThread.map((m, i) => (
                <ParlorMessage key={i} m={m} />
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(201,162,39,.22)', padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                rows={2}
                placeholder="Say something about this photo&hellip;"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{ flex: 1, padding: 10, fontSize: 16, color: '#F0D98C', background: 'rgba(240,217,140,.06)', border: '1px solid rgba(201,162,39,.4)', borderRadius: 2, outline: 'none', resize: 'none' }}
              />
              <div
                onClick={send}
                style={{ padding: '11px 18px', borderRadius: 2, cursor: 'pointer', fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.24em', color: '#2A1C14', background: 'linear-gradient(180deg,#E8C55C,#C9A227)' }}
              >
                SEND
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ margin: '34px 3vw 0', padding: '22px 26px', border: '1px dashed rgba(201,162,39,.3)', borderRadius: 4, background: 'rgba(240,217,140,.03)' }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: '.28em', color: '#C9A227' }}>NOBILITY VAULT &mdash; STORAGE SPEC</div>
        <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5, lineHeight: 1.9, color: 'rgba(232,215,182,.72)', marginTop: 12 }}>
          Everything lives on your drive &mdash; no Google, no third-party account.
          <br />
          <br />
          <span style={{ color: '#F0D98C' }}>/NOBILITY VAULT/</span>
          <br />
          &nbsp;&nbsp;photos/&lt;chapter-slug&gt;/&lt;yyyy-mm-dd&gt;_&lt;uploader&gt;_&lt;n&gt;.jpg &mdash; originals, untouched
          <br />
          &nbsp;&nbsp;album.json &mdash; [{'{'} id, file, chapter, subject, caption, uploader, uploadedAt {'}'}]
          <br />
          <br />
          This page holds uploads and messages in your browser session only &mdash; nothing leaves your device.
        </div>
      </div>
    </div>
  )
}

function ParlorMessage({ m }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.16em', color: m.mine ? '#F0D98C' : 'rgba(232,197,92,.8)' }}>
          {m.who}
        </div>
        <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 12, color: 'rgba(232,215,182,.4)' }}>{m.time}</div>
      </div>
      <div style={{ fontSize: 16, lineHeight: 1.45, color: 'rgba(232,215,182,.85)', marginTop: 3 }}>{m.text}</div>
    </div>
  )
}
