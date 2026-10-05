import { computed, reactive } from 'vue'
import { shelfAlbums } from './useGroups'

// "Dagens plate": one record from my library, the same all day for everybody. It sticks out of the shelf in the 3D
// room and has a card on the home page. (Picked from the date, so no server is needed.)
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

// The server picks it once a day (so every device agrees, and it doesn't jump when the library changes) – the date-based
// pick is only the fallback while the server hasn't answered / has nothing.
const pick = reactive({ day: '', uri: null, rec: null, loaded: false })
export async function loadDaily(force = false) {
  if (!force && pick.day === dayKey() && pick.loaded) return
  try {
    const j = await (await fetch('api.php?action=discover_daily', { cache: 'no-cache' })).json()
    pick.uri = j.uri || null
    pick.rec = j.rec || null
  } catch {}
  pick.day = dayKey()
  pick.loaded = true
}
loadDaily()
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) loadDaily() })
export const dailyAlbum = computed(() => {
  const list = shelfAlbums.value
  if (!list.length || !pick.loaded) return null
  return (pick.uri && list.find((a) => a.uri === pick.uri)) || list[hash(dayKey()) % list.length]
})
/** One of the Last.fm suggestions for today (an album I don't have yet), or null. */
export const dailyRec = computed(() => pick.rec)
