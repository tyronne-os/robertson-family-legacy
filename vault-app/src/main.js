const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const https = require('https')

// Electron's own Chromium profile cache lives in app.getPath('userData'),
// named after the app — keep that separate from the vault's own folder so
// ~/.config/nobility-depository only ever contains vault.json.
app.setName('nobility-depository-electron')

const VAULT_DIR = path.join(os.homedir(), '.config', 'nobility-depository')
const VAULT_FILE = path.join(VAULT_DIR, 'vault.json')
const HF_TOKEN_FILE = path.join(os.homedir(), '.cache', 'huggingface', 'token')

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

function httpsJson(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) })
        } catch (e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 880,
    height: 720,
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

// ---- IPC: HF token verify + CLI sync ----

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

ipcMain.handle('shell:openPath', (_evt, p) => shell.showItemInFolder(p))
