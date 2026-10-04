// niben as a desktop app. The window shows the live site (https://niben.no), so the app is always the
// same version as the website – nothing to update when the site changes. The site sees
// window.nibenApp (preload.js) and switches to its heavier "ultra" graphics.
const { app, BrowserWindow, shell, dialog, net, components, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const SITE = 'https://niben.no/'
// the same shell builds two apps: "niben" (the whole site) and "niben musikk" (just the music
// player) – the latter gets nibenKind: 'music' in its package.json (see music.builder.js)
const KIND = require('./package.json').nibenKind || 'site'
const START = KIND === 'music' ? `${SITE}#/musicplayer` : SITE
ipcMain.on('niben-kind', (e) => { e.returnValue = KIND })
const SITE_HOST = 'niben.no'
// Spotify's login page has to open inside the window (the admin's Spotify connection)
const ALLOWED_HOSTS = [SITE_HOST, 'www.niben.no', 'accounts.spotify.com']

// Use the GPU fully: also on GPUs Chromium is unsure about, and the fast one on laptops with two
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('force_high_performance_gpu')

// ── remember the window's size and position ──
const stateFile = () => path.join(app.getPath('userData'), 'window.json')
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) } catch { return KIND === 'music' ? { width: 1180, height: 780 } : { width: 1440, height: 900 } }
}
function saveState(win) {
  try {
    const b = win.getNormalBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }))
  } catch {}
}

function createWindow() {
  const s = loadState()
  const win = new BrowserWindow({
    x: s.x, y: s.y, width: s.width, height: s.height,
    minWidth: 900, minHeight: 600,
    title: KIND === 'music' ? 'niben musikk' : 'niben',
    backgroundColor: '#eef4fb',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: true,
    },
  })
  if (s.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('close', () => saveState(win))

  // links to other sites open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    try {
      if (!ALLOWED_HOSTS.includes(new URL(url).hostname)) {
        e.preventDefault()
        shell.openExternal(url)
      }
    } catch {}
  })

  // no connection: a small page with "try again"
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: url || START } })
  })

  win.loadURL(START)
  return win
}

// ── the app shell itself rarely changes; when it does, tell the user and offer the download ──
function newer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  return false
}
async function checkShellUpdate(win) {
  try {
    const r = await net.fetch(`${SITE}app/version.json?t=${Date.now()}`)
    if (!r.ok) return
    const v = await r.json()
    if (!v.version || !newer(v.version, app.getVersion())) return
    const key = (KIND === 'music' ? 'music' : '') + (process.platform === 'darwin' ? 'Mac' : 'Windows')
    const url = v[key.charAt(0).toLowerCase() + key.slice(1)]
    if (!url) return
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Last ned', 'Senere'],
      defaultId: 0,
      message: `En ny versjon av ${KIND === 'music' ? 'niben musikk' : 'niben-appen'} (${v.version}) er klar.`,
      detail: 'Innholdet på siden er alltid oppdatert – dette gjelder selve appen. Last ned og installer den nye versjonen.',
    })
    if (response === 0) shell.openExternal(new URL(url, SITE).toString())
  } catch {}
}

app.whenReady().then(async () => {
  // castlabs Electron: fetch/ready the Widevine DRM module, which Spotify's in-page player needs
  try { await components?.whenReady() } catch (e) { console.error('Widevine:', e) }
  const win = createWindow()
  setTimeout(() => checkShellUpdate(win), 8000)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
