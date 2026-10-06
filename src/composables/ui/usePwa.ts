import { reactive } from 'vue'

// Installable app: Chrome/Edge (Mac + Windows) offer an install prompt; Safari uses File → Add to Dock.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
interface IosNavigator extends Navigator { standalone?: boolean }

export const pwa = reactive({
  canInstall: false,
  installed: !!window.nibenApp || window.matchMedia('(display-mode: standalone)').matches || (navigator as IosNavigator).standalone === true,
  safari: /^((?!chrome|android|crios|edg).)*safari/i.test(navigator.userAgent),
})

// The desktop app (Mac with Apple Silicon / Windows) – offered in ordinary desktop browsers
const ua = navigator.userAgent
const touchMac = /Mac/.test(ua) && navigator.maxTouchPoints > 1 // iPad pretending to be a Mac
export const desktopApp: { os: string; url: string } | null = window.nibenApp || touchMac
  ? null
  : /Mac/.test(ua) ? { os: 'Mac', url: 'app/niben-mac-arm64.dmg' }
  : /Windows/.test(ua) ? { os: 'Windows', url: 'app/niben-win-x64.exe' }
  : null

let deferred: InstallPromptEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallPromptEvent
  pwa.canInstall = true
})
window.addEventListener('appinstalled', () => {
  pwa.installed = true
  pwa.canInstall = false
  deferred = null
})

export async function install(): Promise<boolean> {
  if (!deferred) return false
  void deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  pwa.canInstall = false
  return outcome === 'accepted'
}

export function registerServiceWorker(): void {
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
