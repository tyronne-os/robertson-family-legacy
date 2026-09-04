import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { siblings } from '../data/siblings.js'
import NavBar from '../components/NavBar.jsx'
import { unlockAudio } from '../lib/audioUnlock.js'

export default function LandingV2() {
  const location = useLocation()
  const chaptersRef = useRef(null)

  useEffect(() => {
    if (location.state?.scrollTo === 'chapters' && chaptersRef.current) {
      chaptersRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.state])

  return (
    <div style={{ fontFamily: "'EB Garamond',Georgia,serif", background: '#0B0705', color: '#E8D7B6' }}>
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', backgroundColor: '#0B0705' }}>
        {/* Base dark backdrop — matches the site's palette exactly, no white anywhere */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 8%,#1A100A 0%,#0B0705 55%,#050302 100%)' }} />

        {/* Warm ambient glow, same family as the rest of the site */}
        <div
          style={{
            position: 'absolute',
            inset: '-20%',
            pointerEvents: 'none',
            background:
              'radial-gradient(46% 44% at 50% 40%,rgba(232,215,182,.16),rgba(200,175,135,.08) 45%,rgba(11,7,5,0) 78%)',
            filter: 'blur(30px)',
            animation: 'fogLift 6.2s ease-in-out both',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '6%',
            top: '10%',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(255,196,120,.42),rgba(255,150,60,0) 68%)',
            filter: 'blur(16px)',
            animation: 'flicker 4.4s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '8%',
            bottom: '14%',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(201,162,39,.3),rgba(201,162,39,0) 68%)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 320px 100px rgba(5,3,2,.9)', pointerEvents: 'none' }} />

        <NavBar active="home" overlay />

        {/* Hero */}
        <div
          style={{
            position: 'relative',
            minHeight: '100vh',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '110px 5vw 60px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontSize: 11,
              letterSpacing: '.44em',
              color: '#C9A227',
              marginBottom: 14,
              animation: 'riseIn 1.2s ease .3s both',
            }}
          >
            THE ROBERTSON FAMILY
          </div>

          <div
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 900,
              fontSize: 'clamp(26px,4.6vw,64px)',
              lineHeight: 1.02,
              letterSpacing: '.03em',
              color: '#F0D98C',
              textShadow: '0 3px 0 #8A6A1F,0 10px 26px rgba(0,0,0,.85),0 0 70px rgba(240,217,140,.28)',
              marginBottom: 6,
              animation: 'riseIn 1.2s ease .5s both',
            }}
          >
            THE LEGACY OF
            <br />
            MAGNOLIA ROBERTSON
          </div>

          <div
            style={{
              fontFamily: "'Pinyon Script',cursive",
              fontSize: 'clamp(22px,2.8vw,36px)',
              color: 'rgba(232,215,182,.85)',
              marginBottom: 40,
              animation: 'riseIn 1.2s ease .7s both',
            }}
          >
            From Pine Grove to the World
          </div>

          {/* The framed family portrait — cut free of its white background so
              the ornate gold frame sits directly on the site's own dark glow. */}
          <div
            style={{
              position: 'relative',
              width: 'min(360px, 62vw)',
              marginBottom: 44,
              animation: 'riseIn 1.5s ease .9s both',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '-14%',
                borderRadius: '50%',
                background: 'radial-gradient(circle,rgba(240,217,140,.24),rgba(240,217,140,0) 70%)',
                filter: 'blur(20px)',
                pointerEvents: 'none',
              }}
            />
            <img
              src="./images/big-ma-frame-cutout.png"
              alt="The Robertson family, gathered"
              style={{
                position: 'relative',
                width: '100%',
                display: 'block',
                filter: 'drop-shadow(0 26px 46px rgba(0,0,0,.75))',
              }}
            />
          </div>

          <Link
            to="/chapter/0"
            onClick={unlockAudio}
            className="begin-journey-btn"
            style={{
              animation: 'riseIn 1.4s ease 1.3s both, goldSweep 6s linear infinite',
              padding: '20px 56px',
              border: '1px solid rgba(232,197,92,.75)',
              borderRadius: 2,
              fontFamily: "'Cinzel',serif",
              fontWeight: 600,
              fontSize: 'clamp(15px,1.4vw,20px)',
              letterSpacing: '.34em',
              color: '#F0D98C',
              cursor: 'pointer',
              background: 'linear-gradient(90deg,rgba(201,162,39,.06),rgba(240,217,140,.22),rgba(201,162,39,.06))',
              backgroundSize: '200% 100%',
              boxShadow: '0 10px 30px rgba(0,0,0,.55)',
              textDecoration: 'none',
              display: 'inline-block',
              textAlign: 'center',
            }}
          >
            BEGIN THE JOURNEY
          </Link>
        </div>
      </div>

      {/* Footer: wordmark + chapters yet unwritten (unchanged from the current design) */}
      <div
        id="chapters"
        ref={chaptersRef}
        style={{ background: '#090604', borderTop: '1px solid rgba(201,162,39,.18)', padding: '54px 8vw 58px', textAlign: 'center' }}
      >
        <div
          style={{
            fontFamily: "'Cinzel',serif",
            fontWeight: 900,
            fontSize: 'clamp(20px,3.35vw,58px)',
            lineHeight: 1,
            letterSpacing: '.05em',
            color: '#F0D98C',
            textShadow: '0 3px 0 #8A6A1F,0 8px 22px rgba(0,0,0,.85),0 0 60px rgba(240,217,140,.28)',
            whiteSpace: 'nowrap',
          }}
        >
          THE LEGACY OF MAGNOLIA ROBERTSON
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
          <div style={{ height: 1, width: 'min(180px,18vw)', background: 'linear-gradient(90deg,rgba(201,162,39,0),rgba(232,197,92,.8))' }} />
          <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 'clamp(24px,2.6vw,38px)', color: '#C9A227', lineHeight: 1 }}>
            From Pine Grove to the World
          </div>
          <div style={{ height: 1, width: 'min(180px,18vw)', background: 'linear-gradient(90deg,rgba(232,197,92,.8),rgba(201,162,39,0))' }} />
        </div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: '.38em', color: '#C9A227', marginTop: 26 }}>
          THE CHAPTERS YET UNWRITTEN
        </div>
        <div style={{ display: 'flex', gap: 10, margin: '22px auto 0', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
          {siblings.map((s) =>
            s.done ? (
              <SiblingCardLink key={s.num} sibling={s} />
            ) : (
              <div
                key={s.num}
                style={{
                  padding: '13px 20px',
                  borderRadius: 2,
                  textAlign: 'center',
                  minWidth: 168,
                  border: '1px dashed rgba(201,162,39,.32)',
                  background: 'rgba(240,229,206,.04)',
                }}
              >
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.26em', color: 'rgba(232,197,92,.7)' }}>
                  {s.num}
                </div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: '.06em', marginTop: 5, color: 'rgba(232,215,182,.8)' }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "'EB Garamond',serif", fontSize: 13, fontStyle: 'italic', marginTop: 3, color: 'rgba(232,215,182,.45)' }}>
                  Awaiting family history
                </div>
              </div>
            ),
          )}
        </div>
        <div style={{ marginTop: 16, fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 15, color: 'rgba(232,215,182,.5)' }}>
          Awaiting family history &mdash; send your mother&rsquo;s or father&rsquo;s story to fill these pages.
        </div>
      </div>
    </div>
  )
}

function SiblingCardLink({ sibling }) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      to={`/chapter/${sibling.id}`}
      onClick={unlockAudio}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        padding: '13px 20px',
        borderRadius: 2,
        textAlign: 'center',
        minWidth: 168,
        textDecoration: 'none',
        cursor: 'pointer',
        border: '1px solid rgba(232,197,92,.8)',
        background: 'rgba(240,217,140,.10)',
        boxShadow: hover ? '0 0 22px rgba(240,217,140,.35), inset 0 0 0 1px rgba(240,217,140,.5)' : 'none',
        transition: 'background .2s ease,box-shadow .2s ease',
      }}
    >
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.26em', color: '#F0D98C' }}>
        {sibling.num}
      </div>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: '.06em', marginTop: 5, color: '#F0D98C' }}>
        {sibling.label}
      </div>
      <div style={{ fontFamily: "'EB Garamond',serif", fontSize: 13, fontStyle: 'italic', marginTop: 3, color: 'rgba(240,217,140,.75)' }}>
        Read this chapter &#8594;
      </div>
    </Link>
  )
}
