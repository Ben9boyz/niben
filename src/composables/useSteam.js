import { reactive } from 'vue'

// Gaming corner (Steam via the server): profile, what's being played right now, the library.
export const steam = reactive({
  loaded: false,
  configured: false,
  error: null,
  profile: null,
  library: null,
  live: null, // details about the game being played now (or the last one): players online, news, my newest unlocks
  friends: null, // { best, list, online, count } or { hidden }
})

let loading = null
let timer = 0
export function loadSteam(force = false) {
  if (loading && !force) return loading
  loading = fetch('api.php?action=steam_public', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => {
      steam.configured = !!j.configured
      if (j.error) steam.error = j.error
      else {
        steam.error = null
        steam.profile = j.profile || null
        steam.library = j.library || null
        steam.live = j.live || null
        steam.friends = j.friends || null
      }
    })
    .catch(() => { steam.error = 'Fikk ikke kontakt med Steam.' })
    .finally(() => { steam.loaded = true })
  return loading
}

/** Keep "playing now" fresh while the gaming corner is open. Returns a stop function. */
export function watchSteam() {
  loadSteam()
  clearInterval(timer)
  timer = setInterval(() => { if (!document.hidden) loadSteam(true) }, 60000)
  return () => clearInterval(timer)
}

const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps'
/** Wide store banner (460×215). */
export const headerImg = (appid) => `${CDN}/${appid}/header.jpg`
/** Tall library cover (600×900) – not every (older) game has one; fall back to the banner. */
export const coverImg = (appid) => `${CDN}/${appid}/library_600x900.jpg`
export const storeUrl = (appid) => `https://store.steampowered.com/app/${appid}`

/** "i dag", "i går", "for 3 dager siden", "for 2 mnd. siden" … */
export function ago(unix) {
  if (!unix) return ''
  const d = Math.floor((Date.now() / 1000 - unix) / 86400)
  if (d <= 0) return 'i dag'
  if (d === 1) return 'i går'
  if (d < 7) return `for ${d} dager siden`
  if (d < 30) return `for ${Math.round(d / 7)} uker siden`
  if (d < 365) return `for ${Math.round(d / 30)} mnd. siden`
  return `for ${Math.round(d / 365)} år siden`
}

export const fmtHours = (h) => (h >= 100 ? Math.round(h).toLocaleString('nb-NO') : String(h).replace('.', ',')) + ' t'

/** "1 t 23 min" for a session that began at `unix`. */
export function sessionLen(unix) {
  if (!unix) return ''
  const m = Math.max(1, Math.round((Date.now() / 1000 - unix) / 60))
  return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`
}
export const fmtDate = (unix) => (unix ? new Date(unix * 1000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
export const fmtYears = (unix) => (unix ? `${Math.max(1, Math.round((Date.now() / 1000 - unix) / 31557600))} år` : '')
