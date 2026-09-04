const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vaultApi', {
  read: () => ipcRenderer.invoke('vault:read'),
  save: (data) => ipcRenderer.invoke('vault:save', data),
  exportBackup: (data) => ipcRenderer.invoke('vault:export', data),
  importBackup: () => ipcRenderer.invoke('vault:import'),

  hfVerify: (token) => ipcRenderer.invoke('hf:verify', token),
  hfSyncToCli: (token) => ipcRenderer.invoke('hf:syncToCli', token),

  ghVerify: (token) => ipcRenderer.invoke('gh:verify', token),
  ghSyncToCli: (token) => ipcRenderer.invoke('gh:syncToCli', token),

  gcloudSyncToCli: (value) => ipcRenderer.invoke('gcloud:syncToCli', value),

  nvidiaNimSync: (apiKey) => ipcRenderer.invoke('nvidia:nimSync', apiKey),

  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
})
