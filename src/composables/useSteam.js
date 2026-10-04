import { reactive } from 'vue'

// Gaming corner (Steam via the server): profile, what's being played right now, the library.
export const steam = reactive({
  loaded: false,
  configured: false,
  error: null,
  profile: null,
  library: null,
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
  timer = setInterval(() => loadSteam(true), 60000)
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
