let vault = { entries: [], savedAt: null }
let clearArmed = false
let clearTimer = null

const $ = (id) => document.getElementById(id)

// Default providers, always shown even before a key is saved. `key` is the
// vault entry name each one reads/writes under — kept out of the free-form
// "Other stored keys" list below so nothing shows twice.
const PROVIDERS = [
  { id: 'hf', key: 'HF_TOKEN', label: 'Hugging Face', dest: '~/.cache/huggingface/token', kind: 'hf' },
  { id: 'gcloud', key: 'GOOGLE_CLOUD_KEY', label: 'Google Cloud', dest: '~/.config/gcloud/nobility-api-key.env (or gcloud CLI, for a service-account JSON)', kind: 'gcloud' },
  { id: 'github', key: 'GITHUB_TOKEN', label: 'GitHub', dest: 'gh CLI auth (via `gh auth login`)', kind: 'github' },
  { id: 'nim', key: 'NVIDIA_NIM_KEY', label: 'NVIDIA NIM', dest: '~/.ngc/config', kind: 'nim' },
  { id: 'nvent', key: 'NVIDIA_ENTERPRISE_KEY', label: 'NVIDIA Enterprise', dest: 'no universal CLI location — stored + copyable export line', kind: 'enterprise' },
]
const PROVIDER_KEYS = new Set(PROVIDERS.map((p) => p.key))

function fmtTime(iso) {
  if (!iso) return 'not yet saved'
  return new Date(iso).toLocaleString()
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function entryFor(name) {
  return vault.entries.find((e) => e.name === name)
}

function upsertEntry(name, value) {
  vault.entries = vault.entries.filter((e) => e.name !== name)
  vault.entries.push({ name, value, addedAt: new Date().toISOString() })
}

// ---- nav ----

document.querySelectorAll('.navItem').forEach((item) => {
  item.onclick = () => showView(item.dataset.view)
})
$('gotoVaultBtn').onclick = () => showView('vault')

function showView(name) {
  document.querySelectorAll('.navItem').forEach((n) => n.classList.toggle('active', n.dataset.view === name))
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`))
}

// ---- provider cards ----

function renderProviders() {
  const grid = $('providerGrid')
  grid.innerHTML = ''
  PROVIDERS.forEach((p) => {
    const entry = entryFor(p.key)
    const card = document.createElement('div')
    card.className = 'provider-card'
    card.innerHTML = `
      <div class="pname">${escapeHtml(p.label)}</div>
      <div class="pdest">→ ${escapeHtml(p.dest)}</div>
      <div class="pstate ${entry ? 'set' : 'unset'}">${entry ? '● key saved in vault' : '○ no key saved yet'}</div>
      <div class="row">
        <input type="password" class="pInput" data-id="${p.id}" placeholder="Paste ${escapeHtml(p.label)} key" value="${entry ? escapeHtml(entry.value) : ''}">
      </div>
      <div class="toolbar">
        <button class="small pSaveBtn" data-id="${p.id}">Save</button>
        ${p.kind !== 'enterprise' ? `<button class="small ghost pVerifyBtn" data-id="${p.id}">Verify</button>` : ''}
        <button class="small pSyncBtn" data-id="${p.id}">${p.kind === 'enterprise' ? 'Copy Export Line' : 'Sync'}</button>
      </div>
      <div class="status" id="pStatus-${p.id}"></div>
    `
    grid.appendChild(card)
  })

  document.querySelectorAll('.pSaveBtn').forEach((btn) => {
    btn.onclick = async () => {
      const p = PROVIDERS.find((x) => x.id === btn.dataset.id)
      const input = document.querySelector(`.pInput[data-id="${p.id}"]`)
      const val = input.value.trim()
      const statusEl = $(`pStatus-${p.id}`)
      if (!val) {
        statusEl.className = 'status err'
        statusEl.textContent = 'Paste a key first.'
        return
      }
      upsertEntry(p.key, val)
      vault = await window.vaultApi.save(vault)
      statusEl.className = 'status ok'
      statusEl.textContent = '✓ Saved to vault.'
      renderProviders()
      renderOtherKeys()
    }
  })

  document.querySelectorAll('.pVerifyBtn').forEach((btn) => {
    btn.onclick = async () => {
      const p = PROVIDERS.find((x) => x.id === btn.dataset.id)
      const val = document.querySelector(`.pInput[data-id="${p.id}"]`).value.trim()
      const statusEl = $(`pStatus-${p.id}`)
      if (!val) {
        statusEl.className = 'status err'
        statusEl.textContent = 'Paste a key first.'
        return
      }
      statusEl.className = 'status'
      statusEl.textContent = 'Verifying…'
      let res
      if (p.kind === 'hf') res = await window.vaultApi.hfVerify(val)
      else if (p.kind === 'github') res = await window.vaultApi.ghVerify(val)
      else {
        statusEl.className = 'status err'
        statusEl.textContent = 'No independent verify for this provider — try Sync directly.'
        return
      }
      if (res.ok) {
        statusEl.className = 'status ok'
        statusEl.textContent = p.kind === 'hf'
          ? `✓ Valid — signed in as ${res.name} (${res.type}), role: ${res.scopes}`
          : `✓ Valid — GitHub user ${res.login}`
      } else {
        statusEl.className = 'status err'
        statusEl.textContent = `✗ ${res.error}`
      }
    }
  })

  document.querySelectorAll('.pSyncBtn').forEach((btn) => {
    btn.onclick = async () => {
      const p = PROVIDERS.find((x) => x.id === btn.dataset.id)
      const val = document.querySelector(`.pInput[data-id="${p.id}"]`).value.trim()
      const statusEl = $(`pStatus-${p.id}`)
      if (!val) {
        statusEl.className = 'status err'
        statusEl.textContent = 'Paste a key first.'
        return
      }

      if (p.kind === 'enterprise') {
        await navigator.clipboard.writeText(`export NVIDIA_ENTERPRISE_LICENSE=${val}`)
        upsertEntry(p.key, val)
        vault = await window.vaultApi.save(vault)
        statusEl.className = 'status ok'
        statusEl.textContent = '✓ Saved, and an export line is on your clipboard — there is no single standard CLI location for this one.'
        renderProviders()
        return
      }

      statusEl.className = 'status'
      statusEl.textContent = 'Syncing…'
      let res
      if (p.kind === 'hf') res = await window.vaultApi.hfSyncToCli(val)
      else if (p.kind === 'github') res = await window.vaultApi.ghSyncToCli(val)
      else if (p.kind === 'gcloud') res = await window.vaultApi.gcloudSyncToCli(val)
      else if (p.kind === 'nim') res = await window.vaultApi.nvidiaNimSync(val)

      if (res.ok) {
        upsertEntry(p.key, val)
        vault = await window.vaultApi.save(vault)
        statusEl.className = 'status ok'
        statusEl.textContent = `✓ ${res.note || 'Synced.'}${res.path ? ' (' + res.path + ')' : ''}`
        renderProviders()
      } else {
        statusEl.className = 'status err'
        statusEl.textContent = `✗ ${res.error} — nothing was installed.`
      }
    }
  })
}

// ---- other (non-provider) stored keys ----

function renderOtherKeys() {
  const list = $('entryList')
  const empty = $('emptyMsg')
  const others = vault.entries.filter((e) => !PROVIDER_KEYS.has(e.name))
  list.innerHTML = ''
  if (!others.length) {
    empty.style.display = 'block'
  } else {
    empty.style.display = 'none'
    others.forEach((e) => {
      const i = vault.entries.indexOf(e)
      const row = document.createElement('div')
      row.className = 'entry'
      row.innerHTML = `
        <div class="name">${escapeHtml(e.name)}</div>
        <div class="value">${'•'.repeat(Math.min(24, e.value.length))}</div>
        <button data-i="${i}" class="revealBtn ghost">Reveal</button>
        <button data-i="${i}" class="copyBtn ghost">Copy</button>
        <button data-i="${i}" class="delBtn danger">Delete</button>
      `
      list.appendChild(row)
    })
  }

  document.querySelectorAll('.revealBtn').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.i)
      const valEl = btn.parentElement.querySelector('.value')
      const showing = btn.textContent === 'Hide'
      valEl.textContent = showing ? '•'.repeat(Math.min(24, vault.entries[i].value.length)) : vault.entries[i].value
      btn.textContent = showing ? 'Reveal' : 'Hide'
    }
  })
  document.querySelectorAll('.copyBtn').forEach((btn) => {
    btn.onclick = async () => {
      const i = Number(btn.dataset.i)
      await navigator.clipboard.writeText(vault.entries[i].value)
      btn.textContent = 'Copied!'
      setTimeout(() => (btn.textContent = 'Copy'), 1200)
    }
  })
  document.querySelectorAll('.delBtn').forEach((btn) => {
    btn.onclick = () => deleteEntry(Number(btn.dataset.i), btn)
  })
}

async function deleteEntry(i, btn) {
  if (btn.textContent !== 'Confirm?') {
    btn.textContent = 'Confirm?'
    setTimeout(() => {
      if (btn.textContent === 'Confirm?') btn.textContent = 'Delete'
    }, 4000)
    return
  }
  vault.entries.splice(i, 1)
  vault = await window.vaultApi.save(vault)
  renderOtherKeys()
  renderProviders()
}

function render() {
  $('savedAtLabel').textContent = `Universal credential vault for all projects · last saved ${fmtTime(vault.savedAt)}`
  renderProviders()
  renderOtherKeys()
}

$('toggleVisBtn').onclick = () => {
  const el = $('newValue')
  const showing = el.type === 'text'
  el.type = showing ? 'password' : 'text'
  $('toggleVisBtn').textContent = showing ? 'Show' : 'Hide'
}

$('addBtn').onclick = async () => {
  const name = $('newName').value.trim()
  const value = $('newValue').value
  if (!name || !value) return
  upsertEntry(name, value)
  vault = await window.vaultApi.save(vault)
  $('newName').value = ''
  $('newValue').value = ''
  render()
}

$('exportBtn').onclick = async () => {
  const res = await window.vaultApi.exportBackup(vault)
  const statusEl = $('backupStatus')
  if (res.ok) {
    statusEl.className = 'status ok'
    statusEl.textContent = `✓ Exported to ${res.filePath}`
  } else {
    statusEl.className = 'status'
    statusEl.textContent = 'Export cancelled.'
  }
}

$('importBtn').onclick = async () => {
  const res = await window.vaultApi.importBackup()
  const statusEl = $('backupStatus')
  if (res.ok) {
    vault = res.data
    render()
    statusEl.className = 'status ok'
    statusEl.textContent = '✓ Backup imported and saved to the vault.'
  } else {
    statusEl.className = 'status'
    statusEl.textContent = 'Import cancelled.'
  }
}

$('clearBtn').onclick = async () => {
  const btn = $('clearBtn')
  if (!clearArmed) {
    clearArmed = true
    btn.textContent = 'Confirm Clear All?'
    clearTimer = setTimeout(() => {
      clearArmed = false
      btn.textContent = 'Clear All…'
    }, 4000)
    return
  }
  clearTimeout(clearTimer)
  clearArmed = false
  btn.textContent = 'Clear All…'
  vault = await window.vaultApi.save({ entries: [] })
  render()
  const statusEl = $('backupStatus')
  statusEl.className = 'status err'
  statusEl.textContent = 'Vault cleared. (Export a backup beforehand next time — this one was not backed up automatically.)'
}

;(async () => {
  vault = await window.vaultApi.read()
  render()
})()
