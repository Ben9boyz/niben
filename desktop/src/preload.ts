// Tells the website it is running inside the desktop app (heavier graphics, no "install app" button).
// This is castlabs' Electron with Widevine, so Spotify's in-page player works here too (drm: true).
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('nibenApp', {
  platform: process.platform,
  drm: true,
  kind: ipcRenderer.sendSync('niben-kind'), // 'site' | 'music'
})
