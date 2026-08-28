import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { chapters, getChapter } from '../data/chapters.js'
import { useNarrator } from '../hooks/useNarrator.js'
import NavBar from './NavBar.jsx'
import NarratorWidget from './NarratorWidget.jsx'

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

      {/* Two-column layout: portrait left, text right */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: 0,
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 68px)',
        }}
      >
        {/* Left: framed portrait */}
        <div
          style={{
            width: '36%',
            flexShrink: 0,
            position: 'relative',
            backgroundImage: `url('${chapter.image}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg,rgba(11,7,5,0) 70%,rgba(11,7,5,.95) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Right: chapter text */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '32px 4vw 120px 3vw',
            boxSizing: 'border-box',
          }}
        >
          {/* Chapter header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.42em', color: '#C9A227', marginBottom: 6 }}>
              {chapter.title.toUpperCase()}
            </div>
            <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 'clamp(28px,3vw,46px)', color: '#E8D7B6', lineHeight: 1.15 }}>
              {chapter.subtitle}
            </div>
            <div style={{ height: 1, width: 120, background: 'linear-gradient(90deg,rgba(201,162,39,.7),rgba(201,162,39,0))', marginTop: 16 }} />
          </div>

          {/* Opening paragraphs */}
          {chapter.paragraphs.map((p, i) => (
            <p
              key={i}
              style={{
                fontFamily: "'EB Garamond',Georgia,serif",
                fontSize: 'clamp(15px,1.15vw,18px)',
                lineHeight: 1.82,
                color: 'rgba(232,215,182,.9)',
                marginBottom: 20,
                textAlign: 'justify',
              }}
            >
              {p}
            </p>
          ))}

          {/* Sections */}
          {chapter.sections.map((s, i) => (
            <div key={i} style={{ marginTop: 30 }}>
              <div
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 'clamp(13px,1.05vw,16px)',
                  letterSpacing: '.12em',
                  color: '#C9A227',
                  marginBottom: 12,
                }}
              >
                {s.heading}
              </div>
              {s.body.split('\n\n').map((para, j) => (
                <p
                  key={j}
                  style={{
                    fontFamily: "'EB Garamond',Georgia,serif",
                    fontSize: 'clamp(15px,1.15vw,18px)',
                    lineHeight: 1.82,
                    color: 'rgba(232,215,182,.88)',
                    marginBottom: 16,
                    textAlign: 'justify',
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          ))}

          {/* Prev / Next navigation */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 48,
              paddingTop: 20,
              borderTop: '1px solid rgba(201,162,39,.2)',
            }}
          >
            {prev ? (
              <Link
                to={`/chapter/${prev.id}`}
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 11,
                  letterSpacing: '.28em',
                  color: '#C9A227',
                  textDecoration: 'none',
                  opacity: 0.8,
                }}
              >
                ← {prev.title.toUpperCase()}
              </Link>
            ) : (
              <Link
                to="/"
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 11,
                  letterSpacing: '.28em',
                  color: '#C9A227',
                  textDecoration: 'none',
                  opacity: 0.8,
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
                  fontSize: 11,
                  letterSpacing: '.28em',
                  color: '#C9A227',
                  textDecoration: 'none',
                  opacity: 0.8,
                }}
              >
                {next.title.toUpperCase()} →
              </Link>
            ) : (
              <Link
                to="/"
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 11,
                  letterSpacing: '.28em',
                  color: '#C9A227',
                  textDecoration: 'none',
                  opacity: 0.8,
                }}
              >
                RETURN HOME →
              </Link>
            )}
          </div>
        </div>
      </div>

      <NarratorWidget chapter={chapter} narrator={narrator} />
    </div>
  )
}
