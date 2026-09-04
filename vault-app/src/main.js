const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const https = require('https')
const { spawn } = require('child_process')

// Electron's own Chromium profile cache lives in app.getPath('userData'),
// named after the app — keep that separate from the vault's own folder so
// ~/.config/nobility-depository only ever contains vault.json.
app.setName('nobility-depository-electron')

const VAULT_DIR = path.join(os.homedir(), '.config', 'nobility-depository')
const VAULT_FILE = path.join(VAULT_DIR, 'vault.json')
const HF_TOKEN_FILE = path.join(os.homedir(), '.cache', 'huggingface', 'token')
const NGC_CONFIG_DIR = path.join(os.homedir(), '.ngc')
const NGC_CONFIG_FILE = path.join(NGC_CONFIG_DIR, 'config')
const GCLOUD_ENV_DIR = path.join(os.homedir(), '.config', 'gcloud')
const GCLOUD_ENV_FILE = path.join(GCLOUD_ENV_DIR, 'nobility-api-key.env')

function ensureVaultDir() {
  fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 })
}

function readVault() {
  ensureVaultDir()
  if (!fs.existsSync(VAULT_FILE)) return { entries: [], savedAt: null }
  try {
    return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'))
  } catch {
    return { entries: [], savedAt: null }
  }
}

function writeVault(data) {
  ensureVaultDir()
  const payload = { ...data, savedAt: new Date().toISOString() }
  fs.writeFileSync(VAULT_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 })
  return payload
}

function httpsJson(hostname, reqPath, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: reqPath, method: 'GET', headers }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) })
        } catch (e) {
          resolve({ status: res.statusCode, json: null })
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// Runs a CLI command, optionally piping `stdin` to it. Resolves with
// {code, stdout, stderr}; never rejects on a non-zero exit (callers check
// `code`), only on the binary itself not being spawnable (e.g. not installed).
function runCli(cmd, args, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => (stdout += c))
    child.stderr.on('data', (c) => (stderr += c))
    child.on('error', reject) // ENOENT — binary not found on PATH
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    if (stdin != null) child.stdin.write(stdin)
    child.stdin.end()
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 760,
    backgroundColor: '#0B0705',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---- IPC: vault CRUD ----

ipcMain.handle('vault:read', () => readVault())

ipcMain.handle('vault:save', (_evt, data) => writeVault(data))

ipcMain.handle('vault:export', async (_evt, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Vault Backup',
    defaultPath: path.join(os.homedir(), 'Downloads', `robertson-vault-backup-${Date.now()}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 })
  return { ok: true, filePath }
})

ipcMain.handle('vault:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Vault Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths?.[0]) return { ok: false }
  const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'))
  const saved = writeVault(data)
  return { ok: true, data: saved }
})

// ---- IPC: Hugging Face — verify + sync to ~/.cache/huggingface/token ----

ipcMain.handle('hf:verify', async (_evt, token) => {
  try {
    const { status, json } = await httpsJson('huggingface.co', '/api/whoami-v2', {
      Authorization: `Bearer ${token}`,
    })
    if (status !== 200) return { ok: false, error: `HF returned ${status}` }
    return {
      ok: true,
      name: json.name,
      type: json.type,
      scopes: json.auth?.accessToken?.role || json.auth?.type || 'unknown',
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('hf:syncToCli', async (_evt, token) => {
  try {
    const verify = await httpsJson('huggingface.co', '/api/whoami-v2', {
      Authorization: `Bearer ${token}`,
    })
    if (verify.status !== 200) {
      return { ok: false, error: 'Token failed verification — not installed.' }
    }
    fs.mkdirSync(path.dirname(HF_TOKEN_FILE), { recursive: true, mode: 0o700 })
    fs.writeFileSync(HF_TOKEN_FILE, token, { mode: 0o600 })
    return { ok: true, path: HF_TOKEN_FILE, name: verify.json.name }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ---- IPC: GitHub — verify + sync via `gh auth login --with-token` ----

ipcMain.handle('gh:verify', async (_evt, token) => {
  try {
    const { status, json } = await httpsJson('api.github.com', '/user', {
      Authorization: `token ${token}`,
      'User-Agent': 'nobility-depository',
    })
    if (status !== 200) return { ok: false, error: `GitHub returned ${status}` }
    return { ok: true, login: json.login }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('gh:syncToCli', async (_evt, token) => {
  const verify = await httpsJson('api.github.com', '/user', {
    Authorization: `token ${token}`,
    'User-Agent': 'nobility-depository',
  }).catch((e) => ({ status: 0, error: e.message }))
  if (verify.status !== 200) {
    return { ok: false, error: 'Token failed verification — not installed.' }
  }
  try {
    const res = await runCli('gh', ['auth', 'login', '--with-token'], token + '\n')
    if (res.code !== 0) {
      return { ok: false, error: (res.stderr || 'gh auth login failed').trim() }
    }
    return { ok: true, login: verify.json.login, note: 'Installed via `gh auth login` — gh CLI now uses this token.' }
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { ok: false, error: 'GitHub CLI (`gh`) is not installed on this machine. Install it, then Sync again.' }
    }
    return { ok: false, error: e.message }
  }
})

// ---- IPC: Google Cloud — sync an API key (env file) or a service-account
// JSON key (via `gcloud auth activate-service-account`) ----

ipcMain.handle('gcloud:syncToCli', async (_evt, value) => {
  const trimmed = value.trim()
  const looksLikeServiceAccount = trimmed.startsWith('{')

  if (looksLikeServiceAccount) {
    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return { ok: false, error: 'That looks like JSON but did not parse — check it is the full service-account key file contents.' }
    }
    const tmpFile = path.join(os.tmpdir(), `nobility-gcp-key-${Date.now()}.json`)
    fs.writeFileSync(tmpFile, trimmed, { mode: 0o600 })
    try {
      const res = await runCli('gcloud', ['auth', 'activate-service-account', '--key-file=' + tmpFile])
      fs.unlinkSync(tmpFile)
      if (res.code !== 0) return { ok: false, error: (res.stderr || 'gcloud activate-service-account failed').trim() }
      return { ok: true, mode: 'service-account', account: parsed.client_email, note: 'Activated via `gcloud auth activate-service-account`.' }
    } catch (e) {
      try { fs.unlinkSync(tmpFile) } catch {}
      if (e.code === 'ENOENT') {
        return { ok: false, error: 'gcloud CLI is not installed on this machine. Install the Google Cloud SDK, then Sync again.' }
      }
      return { ok: false, error: e.message }
    }
  }

  // Plain API key — there is no CLI login step for a bare API key, so write
  // it to a dedicated env file next to gcloud's own config, in the standard
  // KEY=VALUE shape any shell/SDK can source.
  fs.mkdirSync(GCLOUD_ENV_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(GCLOUD_ENV_FILE, `GOOGLE_API_KEY=${trimmed}\n`, { mode: 0o600 })
  return { ok: true, mode: 'api-key', path: GCLOUD_ENV_FILE, note: 'Written as GOOGLE_API_KEY — source this file, or export it, before running Google Cloud SDK calls that take an API key.' }
})

// ---- IPC: NVIDIA NIM — sync to the real NGC CLI config location ----

ipcMain.handle('nvidia:nimSync', async (_evt, apiKey) => {
  try {
    fs.mkdirSync(NGC_CONFIG_DIR, { recursive: true, mode: 0o700 })
    const body = `[CURRENT]\napikey = ${apiKey.trim()}\nformat_type = ascii\n`
    fs.writeFileSync(NGC_CONFIG_FILE, body, { mode: 0o600 })
    return { ok: true, path: NGC_CONFIG_FILE, note: 'Written to the NGC CLI config — NIM tooling and `ngc` both read from here.' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('shell:openPath', (_evt, p) => shell.showItemInFolder(p))
