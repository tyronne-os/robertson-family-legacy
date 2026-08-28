import { Link } from 'react-router-dom'

function NavLink({ to, active, children, state }) {
  return (
    <Link
      to={to}
      state={state}
      style={{
        color: active ? '#F0D98C' : 'rgba(232,215,182,.55)',
        fontFamily: "'Cinzel',serif",
        fontSize: 15,
        letterSpacing: '.2em',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'color .2s ease',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#F0D98C' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'rgba(232,215,182,.55)' }}
    >
      {children}
    </Link>
  )
}

export default function NavBar({ active = 'home', overlay = false, tagline = null }) {
  return (
    <div
      style={{
        position: overlay ? 'absolute' : 'relative',
        left: overlay ? 0 : undefined,
        right: overlay ? 0 : undefined,
        top: overlay ? 0 : undefined,
        zIndex: overlay ? 5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        padding: overlay ? '18px 110px 18px 4vw' : '16px 110px 16px 4vw',
        borderBottom: overlay ? 'none' : '1px solid rgba(201,162,39,.18)',
        fontFamily: "'Cinzel',serif",
        fontSize: 15,
        letterSpacing: '.26em',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, minWidth: 0 }}>
        {active === 'home' ? (
          <span style={{ color: '#F0D98C' }}>HOME</span>
        ) : (
          <Link
            to="/"
            style={{ color: '#C9A227', fontFamily: "'Cinzel',serif", fontSize: 15, letterSpacing: '.3em', textDecoration: 'none' }}
          >
            &#8592; HOME
          </Link>
        )}
        {tagline && (
          <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 20, color: 'rgba(232,215,182,.75)', whiteSpace: 'nowrap' }}>
            {tagline}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 22 }}>
        <NavLink to="/" state={{ scrollTo: 'chapters' }} active={false}>
          CHAPTERS
        </NavLink>
        <NavLink to="/photo-album" active={active === 'photos'}>
          PHOTO ALBUM
        </NavLink>
        <NavLink to="/reunion-2026" active={active === 'reunion'}>
          REUNION 2026
        </NavLink>
        <NavLink to="/submit-a-chapter" active={active === 'submit'}>
          SUBMIT A CHAPTER
        </NavLink>
      </div>
    </div>
  )
}
