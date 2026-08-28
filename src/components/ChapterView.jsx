import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { chapters, getChapter } from '../data/chapters.js'
import { useNarrator } from '../hooks/useNarrator.js'
import NavBar from './NavBar.jsx'
import NarratorWidget from './NarratorWidget.jsx'

// Helper to create drop-cap from first character
function createDropCap(text) {
  if (!text || text.length === 0) return { cap: '', rest: text }
  const firstChar = text.charAt(0)
  const rest = text.slice(1)
  return { cap: firstChar, rest }
}

export default function ChapterView() {
  const { id } = useParams()
  const chapter = getChapter(Number(id)) ?? chapters[0]
  const narrator = useNarrator(chapter)

  const idx = chapters.findIndex((c) => c.id === chapter.id)
  const prev = idx > 0 ? chapters[idx - 1] : null
  const next = idx < chapters.length - 1 ? chapters[idx + 1] : null

  useEffect(() => {
    narrator.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id])

  // Foreword (Chapter 0) uses centered book-spread layout
  const isForeword = chapter.id === 0

  if (isForeword) {
    return (
      <div
        style={{
          fontFamily: "'EB Garamond',Georgia,serif",
          background: '#0B0705',
          color: '#E8D7B6',
          minHeight: '100vh',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <NavBar active="chapters" tagline="From Pine Grove to the World" />

        {/* Foreword: Centered book-spread layout */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '54px 5vw 120px',
            boxSizing: 'border-box',
            maxHeight: 'calc(100vh - 68px)',
          }}
        >
          {/* Centered title block */}
          <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 800 }}>
            <div
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: '11px',
                letterSpacing: '.42em',
                color: '#C9A227',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              {chapter.title}
            </div>
            <div
              style={{
                fontFamily: "'Pinyon Script',cursive",
                fontSize: 'clamp(32px,4vw,54px)',
                color: '#E8D7B6',
                lineHeight: 1.2,
                marginBottom: 16,
                fontStyle: 'italic',
              }}
            >
              {chapter.subtitle}
            </div>
          </div>

          {/* Centered ornate frame with image */}
          <div
            style={{
              position: 'relative',
              maxWidth: 'min(900px, 90vw)',
              marginBottom: 48,
              padding: '20px',
              background: 'linear-gradient(135deg,#4A2E16 0%,#26150A 60%,#3C2412 100%)',
              border: '2px solid #C9A227',
              boxShadow: '0 30px 70px rgba(0,0,0,.85), inset 0 1px 0 rgba(232,197,92,.55)',
              borderRadius: '2px',
            }}
          >
            {/* Inner mat */}
            <div
              style={{
                background: 'linear-gradient(135deg,#5A3D26 0%,#2D1810 100%)',
                border: '1px solid rgba(201,162,39,.3)',
                padding: '2px',
              }}
            >
              {/* Image */}
              <img
                src={chapter.image}
                alt={chapter.subtitle}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  maxHeight: '55vh',
                  objectFit: 'contain',
                  boxShadow: '0 8px 20px rgba(0,0,0,.4)',
                }}
              />
            </div>
          </div>

          {/* Text below image - centered column */}
          <div style={{ maxWidth: 800, width: '100%' }}>
            {/* Opening paragraph with drop-cap */}
            {chapter.paragraphs[0] && (() => {
              const { cap, rest } = createDropCap(chapter.paragraphs[0])
              return (
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Pinyon Script',cursive",
                      fontSize: '80px',
                      lineHeight: 0.7,
                      color: '#C9A227',
                      fontWeight: 'bold',
                      marginTop: -6,
                      flexShrink: 0,
                    }}
                  >
                    {cap}
                  </div>
                  <p
                    style={{
                      fontFamily: "'EB Garamond',Georgia,serif",
                      fontSize: 'clamp(16px,1.1vw,18px)',
                      lineHeight: 1.75,
                      margin: 0,
                      textAlign: 'center',
                      color: '#E8D7B6',
                    }}
                  >
                    {rest}
                  </p>
                </div>
              )
            })()}

            {/* Remaining paragraphs */}
            {chapter.paragraphs.slice(1).map((p, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "'EB Garamond',Georgia,serif",
                  fontSize: 'clamp(16px,1.1vw,18px)',
                  lineHeight: 1.75,
                  marginBottom: 24,
                  textAlign: 'center',
                  color: '#E8D7B6',
                }}
              >
                {p}
              </p>
            ))}

            {/* Sections */}
            {chapter.sections.map((s, i) => (
              <div key={i} style={{ marginTop: 36 }}>
                <div
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: '12px',
                    letterSpacing: '.24em',
                    color: '#C9A227',
                    marginBottom: 14,
                    textTransform: 'uppercase',
                    fontStyle: 'italic',
                  }}
                >
                  {s.heading}
                </div>
                {s.body.split('\n\n').map((para, j) => (
                  <p
                    key={j}
                    style={{
                      fontFamily: "'EB Garamond',Georgia,serif",
                      fontSize: 'clamp(16px,1.1vw,18px)',
                      lineHeight: 1.75,
                      marginBottom: 18,
                      textAlign: 'center',
                      color: '#E8D7B6',
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            ))}

            {/* Navigation */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 40,
                marginTop: 48,
                paddingTop: 20,
                borderTop: '1px solid rgba(201,162,39,.2)',
              }}
            >
              {next && (
                <Link
                  to={`/chapter/${next.id}`}
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: '11px',
                    letterSpacing: '.24em',
                    color: '#C9A227',
                    textDecoration: 'none',
                  }}
                >
                  {next.title.toUpperCase()} →
                </Link>
              )}
            </div>
          </div>
        </div>

        <NarratorWidget chapter={chapter} narrator={narrator} />
      </div>
    )
  }

  // All other chapters (1-9): Two-column article layout
  return (
    <div
      style={{
        fontFamily: "'EB Garamond',Georgia,serif",
        background: '#0B0705',
        color: '#E8D7B6',
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NavBar active="chapters" tagline="From Pine Grove to the World" />

      {/* Two-column article layout: LEFT text, RIGHT framed image */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: 0,
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 68px)',
        }}
      >
        {/* LEFT COLUMN: Text on parchment background */}
        <div
          style={{
            width: '50%',
            flexShrink: 0,
            overflowY: 'auto',
            padding: '48px 48px 140px',
            boxSizing: 'border-box',
            background: '#F4E9D4',
            position: 'relative',
            borderRight: '1px solid rgba(139,106,31,.25)',
          }}
        >
          {/* Page texture */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.02,
              background: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 /%3E%3C/filter%3E%3Crect width=%22100%22 height=%22100%22 filter=%22url(%23noise)%22 /%3E%3C/svg%3E")',
              pointerEvents: 'none',
            }}
          />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Title & Subtitle */}
            <div style={{ marginBottom: 40, textAlign: 'left' }}>
              <div
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: '11px',
                  letterSpacing: '.42em',
                  color: '#C9A227',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {chapter.title}
              </div>
              <div
                style={{
                  fontFamily: "'Pinyon Script',cursive",
                  fontSize: '42px',
                  color: '#8A6A1F',
                  lineHeight: 1.2,
                  marginBottom: 20,
                }}
              >
                {chapter.subtitle}
              </div>
              <div
                style={{
                  height: '1px',
                  width: '120px',
                  background: 'linear-gradient(90deg,rgba(139,106,31,0),rgba(139,106,31,.8),rgba(139,106,31,0))',
                }}
              />
            </div>

            {/* Paragraphs with drop-cap on first */}
            {chapter.paragraphs.map((p, i) => {
              const isFirst = i === 0
              const { cap, rest } = isFirst ? createDropCap(p) : { cap: '', rest: p }

              return isFirst ? (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 28,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Pinyon Script',cursive",
                      fontSize: '80px',
                      lineHeight: 0.7,
                      color: '#8A6A1F',
                      fontWeight: 'bold',
                      marginTop: -6,
                      flexShrink: 0,
                    }}
                  >
                    {cap}
                  </div>
                  <p
                    style={{
                      fontFamily: "'EB Garamond',Georgia,serif",
                      fontSize: '17px',
                      lineHeight: 1.75,
                      margin: 0,
                      textAlign: 'justify',
                      color: '#3C2412',
                    }}
                  >
                    {rest}
                  </p>
                </div>
              ) : (
                <p
                  key={i}
                  style={{
                    fontFamily: "'EB Garamond',Georgia,serif",
                    fontSize: '17px',
                    lineHeight: 1.75,
                    marginBottom: 24,
                    textAlign: 'justify',
                    color: '#3C2412',
                  }}
                >
                  {p}
                </p>
              )
            })}

            {/* Sections */}
            {chapter.sections.map((s, i) => (
              <div key={i} style={{ marginTop: 36 }}>
                <div
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: '13px',
                    letterSpacing: '.08em',
                    color: '#C9A227',
                    marginBottom: 14,
                    fontStyle: 'italic',
                  }}
                >
                  {s.heading}
                </div>
                {s.body.split('\n\n').map((para, j) => (
                  <p
                    key={j}
                    style={{
                      fontFamily: "'EB Garamond',Georgia,serif",
                      fontSize: '17px',
                      lineHeight: 1.75,
                      marginBottom: 18,
                      textAlign: 'justify',
                      color: '#3C2412',
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            ))}

            {/* Navigation */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 48,
                paddingTop: 20,
                borderTop: '1px solid rgba(139,106,31,.2)',
              }}
            >
              {prev ? (
                <Link
                  to={`/chapter/${prev.id}`}
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: '10px',
                    letterSpacing: '.24em',
                    color: '#C9A227',
                    textDecoration: 'none',
                  }}
                >
                  ← {prev.title.toUpperCase()}
                </Link>
              ) : (
                <Link
                  to="/"
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: '10px',
                    letterSpacing: '.24em',
                    color: '#C9A227',
                    textDecoration: 'none',
                  }}
                >
                  ← RETURN HOME
                </Link>
              )}
              {next ? (
                <Link
                  to={`/chapter/${next.id}`}
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: '10px',
                    letterSpacing: '.24em',
                    color: '#C9A227',
                    textDecoration: 'none',
                  }}
                >
                  {next.title.toUpperCase()} →
                </Link>
              ) : (
                <Link
                  to="/"
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: '10px',
                    letterSpacing: '.24em',
                    color: '#C9A227',
                    textDecoration: 'none',
                  }}
                >
                  RETURN HOME →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Framed image on dark leather background */}
        <div
          style={{
            width: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 40px',
            boxSizing: 'border-box',
            background: '#1A0F09',
            position: 'relative',
            overflow: 'auto',
          }}
        >
          {/* Vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center,transparent 0%,rgba(11,7,5,.6) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Ornate frame */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: '100%',
              maxHeight: '100%',
              padding: '20px',
              background: 'linear-gradient(135deg,#4A2E16 0%,#26150A 60%,#3C2412 100%)',
              border: '2px solid #C9A227',
              boxShadow: '0 30px 70px rgba(0,0,0,.85), inset 0 1px 0 rgba(232,197,92,.55)',
              borderRadius: '2px',
            }}
          >
            {/* Inner mat/bevel */}
            <div
              style={{
                background: 'linear-gradient(135deg,#5A3D26 0%,#2D1810 100%)',
                border: '1px solid rgba(201,162,39,.3)',
                padding: '2px',
              }}
            >
              {/* Image */}
              <img
                src={chapter.image}
                alt={chapter.subtitle}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  maxHeight: 'calc(100vh - 300px)',
                  objectFit: 'contain',
                  boxShadow: '0 8px 20px rgba(0,0,0,.4)',
                }}
              />
            </div>
          </div>

          {/* Caption below frame */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: "'EB Garamond',Georgia,serif",
              fontStyle: 'italic',
              fontSize: '12px',
              color: 'rgba(232,215,182,.5)',
              pointerEvents: 'none',
            }}
          >
            {chapter.subtitle}
          </div>
        </div>
      </div>

      <NarratorWidget chapter={chapter} narrator={narrator} />
    </div>
  )
}
