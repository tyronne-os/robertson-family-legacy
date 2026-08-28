import { useState } from 'react'
import NavBar from '../components/NavBar.jsx'

const CHILDREN = [
  'Magnolia “Big Ma” Robertson — Foreword',
  'Ethel Brown — Chapter 1',
  'Johnny Robertson — Chapter 2',
  'Mary Robertson — Chapter 3',
  'Beaulah Robertson — Chapter 4',
  'Leola Robertson — Chapter 5',
  'Lydia Robertson — Chapter 6',
  'Beatrice Robertson — Chapter 7',
  'Lamar Robertson — Chapter 8',
  'Susanna Robertson — Chapter 9',
]

const inputStyle = {
  padding: '11px 12px',
  fontSize: 17,
  color: '#F0D98C',
  background: 'rgba(240,217,140,.06)',
  border: '1px solid rgba(201,162,39,.4)',
  borderRadius: 2,
  outline: 'none',
  fontFamily: "'EB Garamond',Georgia,serif",
}
const fieldLabel = { fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.24em', color: '#C9A227' }

export default function SubmitChapter() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [child, setChild] = useState('')
  const [story, setStory] = useState('')
  const [fileName, setFileName] = useState('')

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0]
    setFileName(f ? f.name : '')
  }

  const handleSubmit = () => {
    const body = [
      `Submitted by: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Chapter for: ${child}`,
      fileName ? `Photo to attach: ${fileName}` : 'Photo: none attached yet',
      '',
      '--- STORY ---',
      '',
      story,
    ].join('\n')
    const url = `mailto:tjengineer@berylize.com?subject=${encodeURIComponent(
      'Robertson Family Chapter — ' + (child || 'submission'),
    )}&body=${encodeURIComponent(body)}`
    window.location.href = url
  }

  return (
    <div style={{ fontFamily: "'EB Garamond',Georgia,serif", background: '#0B0705', color: '#E8D7B6', minHeight: '100vh', boxSizing: 'border-box', padding: '0 0 64px' }}>
      <NavBar active="submit" />

      <div style={{ maxWidth: 1020, margin: '44px auto 0', textAlign: 'center', padding: '0 4vw' }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 'clamp(24px,3.6vw,52px)', letterSpacing: '.05em', color: '#F0D98C', textShadow: '0 3px 0 #8A6A1F,0 8px 22px rgba(0,0,0,.85)' }}>
          SUBMIT A CHAPTER
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
          <div style={{ height: 1, width: 'min(160px,16vw)', background: 'linear-gradient(90deg,rgba(201,162,39,0),rgba(232,197,92,.8))' }} />
          <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 'clamp(22px,2.4vw,34px)', color: '#C9A227', lineHeight: 1 }}>
            Tell us about your mother or father
          </div>
          <div style={{ height: 1, width: 'min(160px,16vw)', background: 'linear-gradient(90deg,rgba(232,197,92,.8),rgba(201,162,39,0))' }} />
        </div>
      </div>

      <div
        style={{
          maxWidth: 1020,
          margin: '34px 4vw 0',
          marginInline: 'auto',
          padding: '34px clamp(22px,4vw,54px) 40px',
          boxSizing: 'border-box',
          borderRadius: 4,
          background: 'linear-gradient(155deg,#241610 0%,#150C07 55%,#1F130D 100%)',
          boxShadow: '0 26px 60px rgba(0,0,0,.7),inset 0 0 0 1px rgba(201,162,39,.45)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px 26px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabel}>YOUR NAME</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabel}>EMAIL</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabel}>PHONE</span>
            <input type="tel" placeholder="(504) 555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabel}>WHICH CHILD</span>
            <select value={child} onChange={(e) => setChild(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">Select a child&hellip;</option>
              {CHILDREN.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 22 }}>
          <span style={fieldLabel}>THEIR STORY &mdash; PASTE THE ENTIRE NARRATION</span>
          <textarea
            rows={14}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            style={{ ...inputStyle, padding: 14, fontSize: 17.5, lineHeight: 1.55, resize: 'vertical' }}
          />
          <span style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 14, color: 'rgba(232,215,182,.6)' }}>
            Write it however it comes &mdash; we set the type, the drop cap, and the page for you.
          </span>
        </label>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 18,
            marginTop: 24,
            padding: '16px 18px',
            border: '1px dashed rgba(201,162,39,.4)',
            borderRadius: 3,
            background: 'rgba(240,217,140,.04)',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={fieldLabel}>A PHOTOGRAPH FOR THE FACING PAGE</div>
            <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 14.5, color: 'rgba(232,215,182,.65)', marginTop: 3 }}>
              {fileName || 'JPG or PNG — a portrait, a wedding day, a kitchen table'}
            </div>
          </div>
          <label
            style={{
              cursor: 'pointer',
              padding: '11px 24px',
              border: '1px solid rgba(232,197,92,.6)',
              borderRadius: 2,
              fontFamily: "'Cinzel',serif",
              fontSize: 11,
              letterSpacing: '.26em',
              color: '#F0D98C',
              background: 'rgba(240,217,140,.08)',
            }}
          >
            CHOOSE A PHOTO
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 28 }}>
          <div
            onClick={handleSubmit}
            style={{
              padding: '16px 44px',
              border: '1px solid #8A6A1F',
              borderRadius: 2,
              fontFamily: "'Cinzel',serif",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '.3em',
              color: '#2A1C14',
              cursor: 'pointer',
              background: 'linear-gradient(180deg,#E8C55C,#C9A227)',
              boxShadow: '0 8px 20px rgba(60,40,10,.35)',
            }}
          >
            SEND MY CHAPTER
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1020, margin: '30px auto 0', textAlign: 'center', padding: '0 4vw' }}>
        <div style={{ fontFamily: "'EB Garamond',serif", fontSize: 26, color: 'rgba(232,215,182,.85)' }}>
          Have ideas or suggestions and need to reach Tyronne?
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8, flexWrap: 'wrap', fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: '.16em', color: '#F0D98C' }}>
          <a href="tel:9857890096" style={{ color: '#F0D98C' }}>
            985-789-0096
          </a>
          <span style={{ width: 5, height: 5, transform: 'rotate(45deg)', background: '#C9A227', display: 'inline-block' }} />
          <a href="mailto:tjengineer@berylize.com" style={{ color: '#F0D98C' }}>
            tjengineer@berylize.com
          </a>
        </div>
      </div>
    </div>
  )
}
