'use strict';

const { contextBridge, ipcRenderer, shell } = require('electron');

/**
 * Preload script — the only bridge between Node/Electron and the renderer.
 * Keep this minimal and never expose raw ipcRenderer.on to avoid prototype
 * pollution attacks.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Environment ──────────────────────────────────────────────────────────
  isElectron: true,
  platform: process.platform,    // 'win32' | 'darwin' | 'linux'
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  // ── App info ──────────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // ── Window controls ───────────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // ── External links ────────────────────────────────────────────────────────
  openExternal: (url) => {
    // Only allow http/https links to be opened externally
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  },
});
