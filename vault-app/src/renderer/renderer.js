let vault = { entries: [], savedAt: null }
let clearArmed = false
let clearTimer = null

const $ = (id) => document.getElementById(id)

function fmtTime(iso) {
  if (!iso) return 'not yet saved'
  return new Date(iso).toLocaleString()
}

function render() {
  $('savedAtLabel').textContent = `Universal credential vault for all projects · last saved ${fmtTime(vault.savedAt)}`

  const list = $('entryList')
  const empty = $('emptyMsg')
  list.innerHTML = ''
  if (!vault.entries.length) {
    empty.style.display = 'block'
  } else {
    empty.style.display = 'none'
    vault.entries.forEach((e, i) => {
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

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
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
  render()
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
  vault.entries = vault.entries.filter((e) => e.name !== name)
  vault.entries.push({ name, value, addedAt: new Date().toISOString() })
  vault = await window.vaultApi.save(vault)
  $('newName').value = ''
  $('newValue').value = ''
  render()
}

$('hfVerifyBtn').onclick = async () => {
  const keyName = $('hfKeySelect').value.trim()
  const entry = vault.entries.find((e) => e.name === keyName)
  const statusEl = $('hfStatus')
  if (!entry) {
    statusEl.className = 'status err'
    statusEl.textContent = `No stored key named "${keyName}". Add it above first.`
    return
  }
  statusEl.className = 'status'
  statusEl.textContent = 'Verifying…'
  const res = await window.vaultApi.hfVerify(entry.value)
  if (res.ok) {
    statusEl.className = 'status ok'
    statusEl.textContent = `✓ Valid — signed in as ${res.name} (${res.type}), role: ${res.scopes}`
  } else {
    statusEl.className = 'status err'
    statusEl.textContent = `✗ ${res.error}`
  }
}

$('hfSyncBtn').onclick = async () => {
  const keyName = $('hfKeySelect').value.trim()
  const entry = vault.entries.find((e) => e.name === keyName)
  const statusEl = $('hfStatus')
  if (!entry) {
    statusEl.className = 'status err'
    statusEl.textContent = `No stored key named "${keyName}". Add it above first.`
    return
  }
  statusEl.className = 'status'
  statusEl.textContent = 'Syncing to CLI…'
  const res = await window.vaultApi.hfSyncToCli(entry.value)
  if (res.ok) {
    statusEl.className = 'status ok'
    statusEl.textContent = `✓ Installed to ${res.path} — verified as ${res.name}. Any Claude Code session on this machine can now use it.`
  } else {
    statusEl.className = 'status err'
    statusEl.textContent = `✗ ${res.error} — nothing was installed (never overwrites with a dead token).`
  }
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
