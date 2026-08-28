import { useRef, useState } from 'react'

const BAR_HEIGHTS = [7, 13, 9, 15, 6]

function Bars({ active, seed = 0, count = 5 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 15 }}>
      {BAR_HEIGHTS.slice(0, count).map((h, i) => (
        <div
          key={i}
          style={{
            width: 2,
            borderRadius: 1,
            transformOrigin: 'bottom',
            height: h + (seed % 3),
            background: active ? '#F0D98C' : 'rgba(232,197,92,.38)',
            animation: active ? `wave 1.1s ease-in-out ${(-0.15 * i).toFixed(2)}s infinite` : 'none',
          }}
        />
      ))}
    </div>
  )
}

export default function NarratorWidget({ chapter, narrator }) {
  const [expanded, setExpanded] = useState(false)
  const [pop, setPop] = useState(false)

  const jazzRef = useRef(null)
  const [jazzPlaying, setJazzPlaying] = useState(false)

  const toggleJazz = () => {
    const el = jazzRef.current
    if (!el || narrator.muted) return
    if (jazzPlaying) el.pause()
    else el.play().catch(() => {})
    setJazzPlaying(!jazzPlaying)
  }

  const selected = narrator.voices.find((v) => v.id === narrator.voice)

  const chapterLabel = chapter ? chapter.title.toUpperCase() : 'CHAPTER'
  const narrateLabel = narrator.muted
    ? 'NARRATION MUTED'
    : {
        idle: `NARRATE ${chapterLabel}`,
        loading: 'WAKING THE NARRATOR',
        playing: 'NOW READING',
        paused: 'PAUSED',
        blocked: 'TAP TO BEGIN',
        error: 'NARRATOR UNAVAILABLE',
      }[narrator.status] ?? `NARRATE ${chapterLabel}`

  const narrateSub = narrator.muted
    ? 'unmute to listen'
    : narrator.status === 'loading'
      ? narrator.loadPct > 0 ? `${narrator.loadPct}%` : 'preparing…'
      : narrator.status === 'playing'
        ? `${selected?.name.charAt(0)}${selected?.name.slice(1).toLowerCase()}${narrator.remaining ? ' · ' + narrator.remaining : ''}`
        : narrator.status === 'paused'
          ? 'tap to resume'
          : narrator.status === 'blocked'
            ? 'your browser paused the audio'
            : narrator.status === 'error'
              ? narrator.errorMsg
              : chapter?.subtitle ?? ''

  return (
    <div
      style={{ position: 'fixed', right: 30, bottom: 30, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        setExpanded(false)
        setPop(false)
      }}
    >
      <audio ref={jazzRef} src="./audio/jazz-loop.mp3" loop onEnded={() => setJazzPlaying(false)} />

      {/* Voice picker popover */}
      <div
        className="narrator-scroll"
        style={{
          position: 'relative',
          width: 312,
          transformOrigin: 'bottom right',
          opacity: pop ? 1 : 0,
          transform: pop ? 'none' : 'translateY(10px) scale(.97)',
          pointerEvents: pop ? 'auto' : 'none',
          transition: 'opacity .2s ease,transform .26s cubic-bezier(.2,.9,.25,1)',
          borderRadius: 10,
          padding: '13px 11px 11px',
          boxSizing: 'border-box',
          background: 'linear-gradient(155deg,#241610,#150C07 60%,#1F130D)',
          border: '1px solid rgba(201,162,39,.42)',
          boxShadow: '0 24px 54px rgba(0,0,0,.75),inset 0 1px 0 rgba(240,217,140,.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '0 6px 9px',
            borderBottom: '1px solid rgba(201,162,39,.2)',
          }}
        >
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10.5, letterSpacing: '.3em', color: '#C9A227' }}>
            {chapter ? `NARRATOR · ${chapter.title.toUpperCase()}` : 'NARRATOR'}
          </div>
          <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 13, color: 'rgba(232,215,182,.5)' }}>
            tap to preview
          </div>
        </div>
        <div style={{ maxHeight: 268, overflowY: 'auto', padding: '6px 2px 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {narrator.voices.map((v, i) => {
            const on = v.id === narrator.voice
            return (
              <div
                key={v.id}
                onClick={() => narrator.selectVoice(v.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: on
                    ? 'inset 0 0 0 999px rgba(240,217,140,.10), inset 0 0 0 1px rgba(232,197,92,.45)'
                    : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!on) e.currentTarget.style.backgroundColor = 'rgba(240,217,140,.07)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    flex: 'none',
                    border: `1px solid ${on ? '#F0D98C' : 'rgba(232,197,92,.4)'}`,
                    background: on ? '#F0D98C' : 'transparent',
                    boxShadow: on ? '0 0 10px rgba(240,217,140,.65)' : 'none',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: '.08em', color: on ? '#F0D98C' : 'rgba(232,215,182,.82)' }}>
                    {v.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'EB Garamond',serif",
                      fontStyle: 'italic',
                      fontSize: 13,
                      color: 'rgba(232,215,182,.52)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {v.desc}
                  </div>
                </div>
                <div style={{ opacity: on ? 1 : 0.45 }}>
                  <Bars active={on} seed={i} />
                </div>
              </div>
            )
          })}
        </div>
        <div
          style={{
            marginTop: 8,
            padding: '8px 8px 2px',
            borderTop: '1px solid rgba(201,162,39,.18)',
            fontFamily: "'EB Garamond',serif",
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'rgba(232,215,182,.45)',
          }}
        >
          Your chosen voice is remembered across every chapter.
        </div>
        <div
          style={{
            position: 'absolute',
            right: 26,
            bottom: -6,
            width: 11,
            height: 11,
            transform: 'rotate(45deg)',
            background: '#1B100A',
            borderRight: '1px solid rgba(201,162,39,.42)',
            borderBottom: '1px solid rgba(201,162,39,.42)',
          }}
        />
      </div>

      {/* Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 54,
          borderRadius: 27,
          padding: '0 7px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: 'linear-gradient(150deg,#331E14,#1A0F09 55%,#2A1810)',
          border: '1px solid rgba(201,162,39,.45)',
          boxShadow: '0 16px 38px rgba(0,0,0,.6),inset 0 1px 0 rgba(240,217,140,.14)',
          width: expanded ? 440 : 54,
          transition: 'width .34s cubic-bezier(.2,.9,.25,1)',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(true)}
      >
        <div
          style={{
            width: 40,
            height: 40,
            flex: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 34% 30%,rgba(255,196,120,.35),rgba(201,162,39,.12) 70%)',
            border: '1px solid rgba(232,197,92,.55)',
            animation: 'flicker 4s ease-in-out infinite',
          }}
        >
          <Bars active count={4} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            paddingLeft: 14,
            whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            transition: 'opacity .22s ease .06s',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.26em', color: 'rgba(232,197,92,.8)' }}>
              {narrateLabel}
            </div>
            <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 13.5, color: 'rgba(232,215,182,.72)' }}>
              {narrateSub}
            </div>
            <div style={{ width: 132, height: 2, borderRadius: 1, background: 'rgba(232,215,182,.16)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg,#8A6A1F,#F0D98C)',
                  width: narrator.status === 'loading' ? `${narrator.loadPct}%` : '0%',
                  transition: 'width .3s linear',
                }}
              />
            </div>
          </div>

          <div style={{ width: 1, height: 30, background: 'rgba(201,162,39,.25)' }} />

          {/* Global mute — silences narration and jazz on every page, persisted */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (!narrator.muted && jazzPlaying) {
                jazzRef.current?.pause()
                setJazzPlaying(false)
              }
              narrator.toggleMuted()
            }}
            title={narrator.muted ? 'Unmute all sound' : 'Mute all sound everywhere'}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: `1px solid ${narrator.muted ? 'rgba(242,133,122,.65)' : 'rgba(201,162,39,.4)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: narrator.muted ? 'rgba(242,133,122,.14)' : 'transparent',
              fontSize: 13,
              color: narrator.muted ? '#F2857A' : '#F0D98C',
            }}
          >
            {narrator.muted ? '🔇' : '🔊'}
          </button>

          <button
            disabled={narrator.muted}
            onClick={(e) => {
              e.stopPropagation()
              narrator.toggle()
            }}
            title={narrator.status === 'playing' ? 'Pause narration' : 'Play narration'}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '1px solid rgba(201,162,39,.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'transparent',
              fontFamily: "'Cinzel',serif",
              fontSize: 11,
              color: '#F0D98C',
            }}
          >
            {narrator.status === 'playing' ? '❙❙' : '▶'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleJazz()
              }}
              title={jazzPlaying ? 'Pause ambient jazz' : 'Play ambient jazz'}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: '1px solid rgba(201,162,39,.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'transparent',
                fontFamily: "'Cinzel',serif",
                fontSize: 11,
                color: '#F0D98C',
              }}
            >
              {jazzPlaying ? '‖' : '▶'}
            </button>
            <div style={{ position: 'relative', width: 64, height: 3, borderRadius: 2, background: 'rgba(232,215,182,.16)' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '58%', borderRadius: 2, background: 'linear-gradient(90deg,#8A6A1F,#C9A227)' }} />
              <div style={{ position: 'absolute', left: '58%', top: '50%', width: 9, height: 9, margin: '-4.5px 0 0 -4.5px', borderRadius: '50%', background: '#F0D98C', boxShadow: '0 0 8px rgba(240,217,140,.6)' }} />
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setPop((p) => !p)
            }}
            title="Choose narrator voice"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: `1px solid ${pop ? 'rgba(232,197,92,.7)' : 'rgba(201,162,39,.4)'}`,
              background: pop ? 'rgba(240,217,140,.14)' : 'transparent',
              color: pop ? '#F0D98C' : '#C9A227',
              fontSize: 16,
              transform: pop ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform .35s ease,background .2s ease',
            }}
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  )
}
