import { reactive } from 'vue'

// Installable app: Chrome/Edge (Mac + Windows) offer an install prompt; Safari uses File → Add to Dock.
export const pwa = reactive({
  canInstall: false,
  installed: !!window.nibenApp || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  safari: /^((?!chrome|android|crios|edg).)*safari/i.test(navigator.userAgent),
})

// The desktop app (Mac with Apple Silicon / Windows) – offered in ordinary desktop browsers
const ua = navigator.userAgent
const touchMac = /Mac/.test(ua) && navigator.maxTouchPoints > 1 // iPad pretending to be a Mac
export const desktopApp = window.nibenApp || touchMac
  ? null
  : /Mac/.test(ua) ? { os: 'Mac', url: 'app/niben-mac-arm64.dmg' }
  : /Windows/.test(ua) ? { os: 'Windows', url: 'app/niben-win-x64.exe' }
  : null

let deferred = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
  pwa.canInstall = true
})
window.addEventListener('appinstalled', () => {
  pwa.installed = true
  pwa.canInstall = false
  deferred = null
})

export async function install() {
  if (!deferred) return false
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  pwa.canInstall = false
  return outcome === 'accepted'
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // check for a new version whenever the app comes back into view
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
    }).catch(() => {})
  })
}
