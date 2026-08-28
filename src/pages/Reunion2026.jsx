import NavBar from '../components/NavBar.jsx'

export default function Reunion2026() {
  return (
    <div
      style={{
        fontFamily: "'EB Garamond',Georgia,serif",
        background: '#0B0705',
        color: '#E8D7B6',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NavBar active="reunion" tagline="Robertson Family Reunion 2026" />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 5vw 60px',
        }}
      >
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 'clamp(22px,3vw,48px)', fontWeight: 900, letterSpacing: '.1em', color: '#F0D98C', textAlign: 'center', marginBottom: 12 }}>
          REUNION 2026
        </div>
        <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 'clamp(22px,2.6vw,38px)', color: '#C9A227', marginBottom: 40, textAlign: 'center' }}>
          Rooted in Love, Robertson's Reconnected
        </div>

        {/* Poster */}
        <div
          style={{
            border: '2px solid rgba(201,162,39,.55)',
            boxShadow: '0 0 60px rgba(201,162,39,.18), 0 20px 60px rgba(0,0,0,.7)',
            borderRadius: 4,
            overflow: 'hidden',
            maxWidth: 680,
            width: '100%',
          }}
        >
          <img
            src="./images/famreunionposter.jpg"
            alt="Robertson Family Reunion 2026 Poster"
            style={{ width: '100%', display: 'block' }}
          />
        </div>

        <div style={{ marginTop: 28, fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.32em', color: 'rgba(201,162,39,.6)', textAlign: 'center' }}>
          NEW ORLEANS · 2026
        </div>
      </div>
    </div>
  )
}
