import { computed, reactive } from 'vue'
import { shelfAlbums } from './useGroups'
import type { Album } from '@/types'

// "Dagens plate": one record from my library, the same all day for everybody. It sticks out of the shelf in the 3D
// room and has a card on the home page. (Picked from the date, so no server is needed.)
const hash = (s: string): number => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const dayKey = (): string => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

/** A suggestion (an album I don't have yet) from the server. */
export interface DailyRec extends Partial<Album> { uri: string; name: string; why?: string }

// The server picks it once a day (so every device agrees, and it doesn't jump when the library changes) – the date-based
// pick is only the fallback while the server hasn't answered / has nothing.
const pick = reactive({ day: '', uri: null as string | null, rec: null as DailyRec | null, loaded: false })
export async function loadDaily(force = false): Promise<void> {
  if (!force && pick.day === dayKey() && pick.loaded) return
  try {
    const j = (await (await fetch('api.php?action=discover_daily', { cache: 'no-cache' })).json()) as { uri?: string; rec?: DailyRec }
    pick.uri = j.uri ?? null
    pick.rec = j.rec ?? null
  } catch { /* offline: the date-based pick stands */ }
  pick.day = dayKey()
  pick.loaded = true
}
void loadDaily()
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadDaily() })
export const dailyAlbum = computed<Album | null>(() => {
  const list = shelfAlbums.value
  if (!list.length || !pick.loaded) return null
  return (pick.uri ? list.find((a) => a.uri === pick.uri) : undefined) ?? list[hash(dayKey()) % list.length] ?? null
})
/** One of the Last.fm suggestions for today (an album I don't have yet), or null. */
export const dailyRec = computed<DailyRec | null>(() => pick.rec)

/** Another room: its own daily pick. */
export function resetDaily(): void {
  Object.assign(pick, { day: '', uri: null, rec: null, loaded: false })
}
