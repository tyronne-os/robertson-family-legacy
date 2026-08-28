import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { chapters, getChapter } from '../data/chapters.js'
import { useNarrator } from '../hooks/useNarrator.js'
import NavBar from './NavBar.jsx'
import NarratorWidget from './NarratorWidget.jsx'

export default function ChapterView() {
  const { id } = useParams()
  const chapter = getChapter(Number(id)) ?? chapters[0]
  const narrator = useNarrator(chapter)

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
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 2vw 20px',
      }}
    >
      <NavBar active="chapters" tagline="From Pine Grove to the World" />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          padding: '12px 2vw 0',
        }}
      >
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: '.4em', color: '#C9A227' }}>
          {chapter.title.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 32, color: '#E8D7B6', lineHeight: 1 }}>
          {chapter.subtitle}
        </div>
      </div>

      <div
        style={{
          width: 'auto',
          maxWidth: '100%',
          aspectRatio: '2400 / 1792',
          alignSelf: 'center',
          margin: '12px auto 0',
          position: 'relative',
          flex: '1 1 auto',
          minHeight: 0,
          border: '1px solid rgba(201,162,39,.22)',
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: '#0B0705',
          backgroundImage: `url('${chapter.image}')`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          boxShadow: '0 30px 70px rgba(0,0,0,.75)',
        }}
      />

      <NarratorWidget chapter={chapter} narrator={narrator} />
    </div>
  )
}
