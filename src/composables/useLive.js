import { reactive, computed } from 'vue'

// What it is like where I live right now (set in Admin → Oversikt → Bosted): the site turns dark when it is night
// there and rains when it rains there. Refreshed every 10 minutes; day / night is recomputed locally from the sunrise
// and sunset times so it flips on time between the refreshes.
export const live = reactive({ loaded: false, configured: false, name: '', kind: 'clear', temp: null, cloud: 0, wind: 0, isDay: true, sunrise: [], sunset: [], tick: Date.now() })
let timer = 0
let tickTimer = 0

export async function loadLive() {
  try {
    const j = await (await fetch('api.php?action=home_live', { cache: 'no-store' })).json()
    live.configured = !!j.configured
    if (j.configured && j.kind) {
      live.name = j.name || ''
      live.kind = j.kind
      live.temp = j.temp
      live.cloud = j.cloud || 0
      live.wind = j.wind || 0
      live.isDay = !!j.is_day
      live.sunrise = j.sunrise || []
      live.sunset = j.sunset || []
    }
  } catch {}
  live.loaded = true
}
export function watchLive() {
  if (timer) return
  loadLive()
  timer = setInterval(() => { if (!document.hidden) loadLive() }, 600000)
  tickTimer = setInterval(() => (live.tick = Date.now()), 30000)
}

/** Day or night where I live – from the sunrise / sunset list when we have it, else what the weather service said. */
export const liveDay = computed(() => {
  const now = live.tick / 1000
  const rise = live.sunrise || [], set = live.sunset || []
  if (rise.length && set.length) {
    // the last sunrise before now and the first sunset after it decide
    const r = Math.max(...rise.filter((x) => x <= now), -Infinity)
    const s = Math.min(...set.filter((x) => x >= now), Infinity)
    if (Number.isFinite(r) && Number.isFinite(s)) return set.filter((x) => x >= now).indexOf(s) >= 0 && s - now < 86400 && now >= r && (rise.filter((x) => x > now)[0] ?? Infinity) > s
  }
  return live.isDay
})
/** The weather to show: only when it is set up. */
export const weather = computed(() => (live.configured ? { kind: live.kind, cloud: live.cloud, wind: live.wind, day: liveDay.value } : null))
