import { useState, useEffect, useRef } from 'react'
import { uploadFiles, fileExists } from '@huggingface/hub'

const STORAGE_KEY = 'robertson-legacy:settings'
const REPO_NAME = 'AIBRUH/robertson-family-legacy'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function persist(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// All static assets the site needs — discovered from origin
const STATIC_ASSETS = [
  '/images/big-ma-book.jpeg',
  '/images/chapter-06.jpeg',
  '/audio/jazz-loop.mp3',
  '/audio/silence.wav',
]

async function collectFiles(onStatus) {
  const files = []

  // 1. Fetch index.html + discover hashed asset paths
  onStatus('Reading index.html…')
  const idxResp = await fetch('/index.html')
  const idxHtml = await idxResp.text()

  if (idxHtml.includes('/@vite/client') || idxHtml.includes('@react-refresh')) {
    throw new Error(
      'This page is the Vite DEV server, not a production build. Run "npm run build" and open the built dist/ (or the already-deployed Space) before deploying — deploying from dev mode would ship a broken site.',
    )
  }

  files.push({ path: 'index.html', content: new Blob([idxHtml], { type: 'text/html' }) })

  const assetRefs = [...idxHtml.matchAll(/\/assets\/[A-Za-z0-9._-]+/g)].map((m) => m[0])
  const assetPaths = [...new Set(assetRefs)]

  if (assetPaths.length === 0) {
    throw new Error('No built /assets/ files found in index.html — this does not look like a production build. Run "npm run build" first.')
  }

  // 2. Fetch all JS/CSS/WASM assets
  for (const p of assetPaths) {
    onStatus(`Fetching ${p.split('/').pop()}…`)
    const resp = await fetch(p)
    const blob = await resp.blob()
    files.push({ path: p.slice(1), content: blob })
  }

  // 3. Static images / audio
  for (const p of STATIC_ASSETS) {
    onStatus(`Fetching ${p.split('/').pop()}…`)
    const resp = await fetch(p)
    const blob = await resp.blob()
    files.push({ path: p.slice(1), content: blob })
  }

  return files
}

async function deployToHF({ token, onStatus, onProgress }) {
  onStatus('Collecting site files…')
  const files = await collectFiles(onStatus)

  onStatus(`Uploading ${files.length} files to Hugging Face…`)
  onProgress(0)

  await uploadFiles({
    repo: { type: 'space', name: REPO_NAME },
    accessToken: token,
    files,
    commitTitle: 'Deploy via Robertson Legacy Vault',
    useWebWorkers: false,
  })

  onProgress(100)
  onStatus('Deployed ✓')
}

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)

  const [hfToken, setHfToken] = useState('')
  const [hfUser, setHfUser] = useState('')
  const [showToken, setShowToken] = useState(false)

  const [gcpProvider, setGcpProvider] = useState('Google Cloud')
  const [gcpKeyName, setGcpKeyName] = useState('')
  const [gcpKey, setGcpKey] = useState('')
  const [gcpUrl, setGcpUrl] = useState('')
  const [showGcpKey, setShowGcpKey] = useState(true)
  const [gcpTestStatus, setGcpTestStatus] = useState(null) // null | testing | ok | fail

  const [testStatus, setTestStatus] = useState(null) // null | testing | ok | fail
  const [deployState, setDeployState] = useState('idle') // idle | running | done | error
  const [deployMsg, setDeployMsg] = useState('')
  const [deployPct, setDeployPct] = useState(0)

  const abortRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const s = loadSettings()
    if (s.hfToken) setHfToken(s.hfToken)
    if (s.hfUser) setHfUser(s.hfUser)
    if (s.gcpProvider) setGcpProvider(s.gcpProvider)
    if (s.gcpKeyName) setGcpKeyName(s.gcpKeyName)
    if (s.gcpKey) setGcpKey(s.gcpKey)
    if (s.gcpUrl) setGcpUrl(s.gcpUrl)

  }, [open])

  const handleTest = async () => {
    if (!hfToken.trim()) return
    setTestStatus('testing')
    try {
      const res = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { Authorization: `Bearer ${hfToken.trim()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setHfUser(data.name || data.fullname || hfUser)
        setTestStatus('ok')
      } else {
        setTestStatus('fail')
      }
    } catch {
      setTestStatus('fail')
    }
  }

  const handleGcpTest = async () => {
    const url = gcpUrl.trim()
    if (!url) return
    setGcpTestStatus('testing')
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(6000) })
      setGcpTestStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setGcpTestStatus('fail')
    }
  }

  const handleSaveAndDeploy = async () => {
    const token = hfToken.trim()
    if (!token) return

    persist({ hfToken: token, hfUser: hfUser.trim(), gcpProvider: gcpProvider.trim(), gcpKeyName: gcpKeyName.trim(), gcpKey: gcpKey.trim(), gcpUrl: gcpUrl.trim() })

    abortRef.current = false
    setDeployState('running')
    setDeployPct(0)
    setDeployMsg('Starting deployment…')

    try {
      await deployToHF({
        token,
        onStatus: (msg) => { if (!abortRef.current) setDeployMsg(msg) },
        onProgress: (pct) => { if (!abortRef.current) setDeployPct(pct) },
      })
      if (!abortRef.current) {
        setDeployState('done')
        setDeployMsg('Live on Hugging Face ✓')
        setDeployPct(100)
      }
    } catch (err) {
      if (!abortRef.current) {
        setDeployState('error')
        setDeployMsg(err.message || 'Deploy failed')
      }
    }
  }

  const [savedFlash, setSavedFlash] = useState(false)
  const handleSaveKeys = () => {
    persist({ hfToken: hfToken.trim(), hfUser: hfUser.trim(), gcpProvider: gcpProvider.trim(), gcpKeyName: gcpKeyName.trim(), gcpKey: gcpKey.trim(), gcpUrl: gcpUrl.trim() })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const fileInputRef = useRef(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const confirmTimerRef = useRef(null)

  const handleClearAllClick = () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      confirmTimerRef.current = setTimeout(() => setConfirmingClear(false), 4000)
      return
    }
    clearTimeout(confirmTimerRef.current)
    setConfirmingClear(false)
    setHfToken(''); setHfUser(''); setGcpKey(''); setGcpKeyName(''); setGcpUrl('')
    setTestStatus(null); setDeployState('idle'); persist({})
  }

  const handleExportBackup = () => {
    const data = loadSettings()
    if (!data || Object.keys(data).length === 0) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `robertson-legacy-vault-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        persist(data)
        if (data.hfToken) setHfToken(data.hfToken)
        if (data.hfUser) setHfUser(data.hfUser)
        if (data.gcpProvider) setGcpProvider(data.gcpProvider)
        if (data.gcpKeyName) setGcpKeyName(data.gcpKeyName)
        if (data.gcpKey) setGcpKey(data.gcpKey)
        if (data.gcpUrl) setGcpUrl(data.gcpUrl)
      } catch {
        // ignore malformed backup file
      }
    }
    reader.readAsText(file)
  }

  const handleCancel = () => {
    abortRef.current = true
    setDeployState('idle')
    setDeployMsg('')
    setDeployPct(0)
  }

  const testColor = { ok: '#6EE7A0', fail: '#F87171', testing: '#F0D98C' }[testStatus] ?? 'transparent'
  const testLabel = { ok: 'Connected ✓', fail: 'Invalid token', testing: 'Verifying…' }[testStatus] ?? ''

  const deploying = deployState === 'running'
  const deployDone = deployState === 'done'
  const deployErr = deployState === 'error'

  return (
    <>
      {/* Gear trigger */}
      <button
        onClick={() => setOpen(true)}
        title="Site settings"
        style={{
          position: 'fixed', top: 22, right: 26, zIndex: 60,
          width: 40, height: 40, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(26,15,9,.72)',
          border: '1px solid rgba(201,162,39,.38)',
          boxShadow: '0 4px 18px rgba(0,0,0,.45)',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
          color: '#C9A227', fontSize: 17,
          transition: 'border-color .2s,box-shadow .2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(232,197,92,.7)'
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,162,39,.25)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(201,162,39,.38)'
          e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,.45)'
        }}
      >⚙</button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => { if (!deploying) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            background: 'rgba(8,5,3,.62)', backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 80,
        width: 'min(460px, 96vw)',
        background: 'linear-gradient(170deg,#241610,#150C07 55%,#1F130D)',
        borderLeft: '1px solid rgba(201,162,39,.38)',
        boxShadow: '-24px 0 64px rgba(0,0,0,.7)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .36s cubic-bezier(.2,.9,.25,1)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(201,162,39,.2)',
        }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.42em', color: '#C9A227' }}>
              THE VAULT
            </div>
            <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: 30, color: '#E8D7B6', lineHeight: 1.1, marginTop: 2 }}>
              Robertson Legacy
            </div>
          </div>
          <button
            onClick={() => { if (!deploying) setOpen(false) }}
            disabled={deploying}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid rgba(201,162,39,.3)', background: 'transparent',
              color: 'rgba(232,215,182,.6)', fontSize: 18, cursor: deploying ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>

          {/* Access section */}
          <section>
            <div style={sLabel}>HUGGING FACE ACCESS</div>
            <div style={sDesc}>
              Store your write-scope token here. Clicking{' '}
              <strong style={{ color: 'rgba(240,217,140,.8)' }}>Save &amp; Deploy</strong> will
              push the full site directly to the Robertson Legacy Space — no terminal needed.
            </div>

            <label style={fLabel}>Space owner</label>
            <input
              type="text" value={hfUser}
              onChange={(e) => setHfUser(e.target.value)}
              placeholder="AIBRUH"
              style={inp} spellCheck={false} autoComplete="off"
              disabled={deploying}
            />

            <label style={{ ...fLabel, marginTop: 16 }}>Access token</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={hfToken}
                onChange={(e) => { setHfToken(e.target.value); setTestStatus(null); setDeployState('idle') }}
                placeholder="hf_••••••••••••••••••••"
                style={{ ...inp, paddingRight: 58 }}
                spellCheck={false} autoComplete="off"
                disabled={deploying}
              />
              <button
                onClick={() => setShowToken((v) => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'rgba(232,215,182,.5)',
                  cursor: 'pointer', fontSize: 11, fontFamily: "'Cinzel',serif",
                  letterSpacing: '.05em', padding: '4px 6px',
                }}
              >{showToken ? 'HIDE' : 'SHOW'}</button>
            </div>
            <div style={{ marginTop: 5, fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 13, color: 'rgba(232,215,182,.4)' }}>
              Generate at huggingface.co/settings/tokens — needs <strong style={{ color: 'rgba(232,215,182,.55)' }}>Write</strong> scope.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <button
                onClick={handleTest}
                disabled={!hfToken.trim() || deploying || testStatus === 'testing'}
                style={{
                  ...btnOutline,
                  opacity: (!hfToken.trim() || deploying) ? 0.4 : 1,
                  cursor: (!hfToken.trim() || deploying) ? 'not-allowed' : 'pointer',
                }}
              >{testStatus === 'testing' ? 'Verifying…' : 'Test Connection'}</button>
              {testStatus && (
                <span style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 14, color: testColor }}>
                  {testLabel}
                </span>
              )}
            </div>
          </section>

          {/* Google Cloud section */}
          <div style={{ height: 1, background: 'rgba(201,162,39,.14)' }} />
          <section>
            <div style={sLabel}>API KEY — PHOTO LAB</div>
            <div style={sDesc}>
              Store your cloud API credentials here. The Photo Lab uses these to connect
              to the AI photo restoration backend when you're ready to activate it.
            </div>

            {/* Row: Provider + Key Name */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={fLabel}>Provider</label>
                <input
                  type="text"
                  value={gcpProvider}
                  onChange={(e) => setGcpProvider(e.target.value)}
                  placeholder="Google Cloud"
                  style={inp}
                  spellCheck={false}
                  autoComplete="off"
                  disabled={deploying}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fLabel}>Key Name</label>
                <input
                  type="text"
                  value={gcpKeyName}
                  onChange={(e) => setGcpKeyName(e.target.value)}
                  placeholder="e.g. MIRANDA"
                  style={inp}
                  spellCheck={false}
                  autoComplete="off"
                  disabled={deploying}
                />
              </div>
            </div>

            {/* API Key value */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
              <label style={{ ...fLabel, marginBottom: 0 }}>API Key</label>
              <button
                onClick={() => setShowGcpKey((v) => !v)}
                style={{ background: 'none', border: 'none', color: 'rgba(232,215,182,.5)', cursor: 'pointer', fontSize: 11, fontFamily: "'Cinzel',serif", letterSpacing: '.05em', padding: 0 }}
              >{showGcpKey ? 'HIDE' : 'SHOW'}</button>
            </div>
            <textarea
              value={gcpKey}
              onChange={(e) => { setGcpKey(e.target.value); setGcpTestStatus(null) }}
              placeholder="Paste your API key here…"
              rows={showGcpKey ? 3 : 1}
              spellCheck={false}
              autoComplete="off"
              disabled={deploying}
              style={{
                ...inp,
                resize: 'none',
                fontFamily: 'ui-monospace,Menlo,monospace',
                fontSize: 13,
                letterSpacing: '.04em',
                filter: showGcpKey ? 'none' : 'blur(4px)',
                userSelect: showGcpKey ? 'auto' : 'none',
                transition: 'filter .2s',
                lineBreak: 'anywhere',
              }}
            />

            {/* Backend URL — optional, shown muted until filled */}
            <label style={{ ...fLabel, marginTop: 16, opacity: .6 }}>Backend URL <span style={{ letterSpacing: '.1em', fontFamily: "'EB Garamond',serif", fontStyle: 'italic', textTransform: 'none' }}>(optional — add after VM deploy)</span></label>
            <input
              type="text"
              value={gcpUrl}
              onChange={(e) => { setGcpUrl(e.target.value); setGcpTestStatus(null) }}
              placeholder="http://YOUR_GCP_IP:8000"
              style={{ ...inp, opacity: gcpUrl ? 1 : .45 }}
              spellCheck={false}
              autoComplete="off"
              disabled={deploying}
            />

            {/* Test button — only active when URL is present */}
            {gcpUrl.trim() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                <button
                  onClick={handleGcpTest}
                  disabled={deploying || gcpTestStatus === 'testing'}
                  style={{ ...btnOutline, cursor: deploying ? 'not-allowed' : 'pointer' }}
                >{gcpTestStatus === 'testing' ? 'Pinging…' : 'Test Backend'}</button>
                {gcpTestStatus && (
                  <span style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 14, color: { ok: '#6EE7A0', fail: '#F87171', testing: '#F0D98C' }[gcpTestStatus] }}>
                    {{ ok: 'Online ✓', fail: 'Unreachable — check VM / firewall', testing: 'Pinging…' }[gcpTestStatus]}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Deploy status box — shows when running/done/error */}
          {deployState !== 'idle' && (
            <div style={{
              borderRadius: 6, padding: '14px 16px',
              background: deployDone
                ? 'rgba(110,231,160,.08)'
                : deployErr
                  ? 'rgba(248,113,113,.08)'
                  : 'rgba(240,217,140,.06)',
              border: `1px solid ${deployDone ? 'rgba(110,231,160,.35)' : deployErr ? 'rgba(248,113,113,.35)' : 'rgba(201,162,39,.28)'}`,
            }}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.28em', color: deployDone ? '#6EE7A0' : deployErr ? '#F87171' : '#C9A227', marginBottom: 6 }}>
                {deployDone ? 'DEPLOYED' : deployErr ? 'DEPLOY FAILED' : 'DEPLOYING'}
              </div>
              <div style={{ fontFamily: "'EB Garamond',serif", fontSize: 14, color: 'rgba(232,215,182,.75)', fontStyle: 'italic' }}>
                {deployMsg}
              </div>
              {deploying && (
                <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'rgba(201,162,39,.18)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'linear-gradient(90deg,#8A6A1F,#F0D98C)',
                    width: deployPct > 0 ? `${deployPct}%` : '100%',
                    animation: deployPct === 0 ? 'goldSweep 1.8s linear infinite' : 'none',
                    backgroundSize: deployPct === 0 ? '200% 100%' : 'auto',
                    transition: 'width .4s ease',
                  }} />
                </div>
              )}
              {deployDone && (
                <a
                  href={`https://huggingface.co/spaces/${REPO_NAME}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: 10, fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.22em', color: '#6EE7A0', textDecoration: 'none', borderBottom: '1px solid rgba(110,231,160,.4)', paddingBottom: 2 }}
                >
                  VIEW LIVE SPACE ↗
                </a>
              )}
            </div>
          )}

          {/* About */}
          <div style={{ height: 1, background: 'rgba(201,162,39,.14)' }} />
          <section>
            <div style={sLabel}>SPACE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                ['Repo', 'AIBRUH/robertson-family-legacy'],
                ['SDK', 'Static (Vite + React)'],
                ['Narrator', 'Kokoro TTS — in-browser AI'],
                ['Ready', 'Chapter VI · Lydia Robertson'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.2em', color: '#C9A227', minWidth: 62 }}>{k}</span>
                  <span style={{ fontFamily: "'EB Garamond',serif", fontSize: 14, color: 'rgba(232,215,182,.6)' }}>{v}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px 22px',
          borderTop: '1px solid rgba(201,162,39,.18)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {!deploying ? (
            <>
              {/* Save Keys — always enabled */}
              <button
                onClick={handleSaveKeys}
                style={{
                  ...btnPrimary,
                  background: savedFlash ? 'rgba(110,231,160,.18)' : 'rgba(240,217,140,.10)',
                  borderColor: savedFlash ? 'rgba(110,231,160,.6)' : 'rgba(232,197,92,.5)',
                  color: savedFlash ? '#6EE7A0' : '#F0D98C',
                  cursor: 'pointer',
                }}
              >
                {savedFlash ? 'Keys Saved ✓' : 'Save Keys'}
              </button>

              {/* Deploy — requires HF token */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleSaveAndDeploy}
                  disabled={!hfToken.trim()}
                  style={{
                    ...btnPrimary,
                    opacity: !hfToken.trim() ? 0.4 : 1,
                    cursor: !hfToken.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {deployDone ? 'Deploy Again' : 'Save & Deploy to HF'}
                </button>
                <button
                  onClick={handleClearAllClick}
                  style={{
                    ...btnGhost,
                    color: confirmingClear ? '#F87171' : btnGhost.color,
                    borderColor: confirmingClear ? 'rgba(248,113,113,.55)' : btnGhost.borderColor,
                  }}
                >{confirmingClear ? 'Click again to confirm' : 'Clear All'}</button>
              </div>

              {/* Backup — export/import keys so localStorage loss can't cost you the vault */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleExportBackup}
                  style={{ ...btnGhost, flex: 1 }}
                  title="Download your saved keys as a local backup file"
                >Export Backup</button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ ...btnGhost, flex: 1 }}
                  title="Restore keys from a previously exported backup file"
                >Import Backup</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  style={{ display: 'none' }}
                />
              </div>
              <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 12.5, color: 'rgba(232,215,182,.4)', textAlign: 'center' }}>
                Backup files contain your raw keys — store them somewhere private.
              </div>
            </>
          ) : (
            <button onClick={handleCancel} style={{ ...btnGhost, color: '#F87171', borderColor: 'rgba(248,113,113,.4)' }}>
              Cancel Deploy
            </button>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Shared styles ── */
const sLabel = { fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.36em', color: '#C9A227', marginBottom: 8 }
const sDesc  = { fontFamily: "'EB Garamond',serif", fontStyle: 'italic', fontSize: 14.5, color: 'rgba(232,215,182,.55)', marginBottom: 16, lineHeight: 1.65 }
const fLabel = { display: 'block', fontFamily: "'Cinzel',serif", fontSize: 9.5, letterSpacing: '.28em', color: 'rgba(232,197,92,.7)', marginBottom: 7 }
const inp    = { width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 4, border: '1px solid rgba(201,162,39,.35)', background: 'rgba(11,7,5,.55)', color: '#E8D7B6', fontFamily: "'EB Garamond',serif", fontSize: 15, outline: 'none' }
const btnPrimary = { flex: 1, padding: '13px 0', borderRadius: 3, border: '1px solid rgba(232,197,92,.75)', background: 'linear-gradient(90deg,rgba(201,162,39,.14),rgba(240,217,140,.28),rgba(201,162,39,.14))', color: '#F0D98C', fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: '.3em', cursor: 'pointer' }
const btnOutline = { padding: '9px 18px', borderRadius: 3, border: '1px solid rgba(201,162,39,.45)', background: 'transparent', color: '#C9A227', fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.22em' }
const btnGhost   = { padding: '13px 18px', borderRadius: 3, border: '1px solid rgba(201,162,39,.22)', background: 'transparent', color: 'rgba(232,215,182,.45)', fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: '.22em', cursor: 'pointer' }
