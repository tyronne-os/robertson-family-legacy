const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vaultApi', {
  read: () => ipcRenderer.invoke('vault:read'),
  save: (data) => ipcRenderer.invoke('vault:save', data),
  exportBackup: (data) => ipcRenderer.invoke('vault:export', data),
  importBackup: () => ipcRenderer.invoke('vault:import'),
  hfVerify: (token) => ipcRenderer.invoke('hf:verify', token),
  hfSyncToCli: (token) => ipcRenderer.invoke('hf:syncToCli', token),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
})
