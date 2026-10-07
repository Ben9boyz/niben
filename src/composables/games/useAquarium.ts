import { markRaw, reactive, shallowReactive } from 'vue'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { decor, loadDecor } from '@/composables/room/useDecor'
import { catchUp, fillQuests, fromSaved, makeTank, newTrophies, toSaved, trophyOf, type Tank, type Trophy } from '@/lib/games/aquarium'

// The aquarium games of the room: one tank per aquarium hobby. Loaded once (anybody can watch), played and saved by the room's
// owner – a little after each change and when the page is left. The 3D room shows the same fish (Room.vue → setTankFish).
interface Game { tank: Tank; mine: boolean; away: number; error: string; saving: boolean; dirty: boolean; won: Trophy[]; level: number | null }
export const games = shallowReactive(new Map<string, Game>())
/** Bumped whenever a tank changes the fish it has (the 3D room re-draws its fish then). */
export const tankVersion = reactive({ n: 0 })
const loading = new Map<string, Promise<Game | null>>()

export function loadGame(id: string, mine: boolean): Promise<Game | null> {
  const have = games.get(id)
  if (have) { have.mine = mine; return Promise.resolve(have) }
  let p = loading.get(id)
  if (!p) {
    p = (async () => {
      try {
        const r = await api<{ state: unknown }>('mod_game_get', undefined, { query: `&id=${encodeURIComponent(id)}` })
        const s = fromSaved(r.state)
        const g: Game = reactive({ tank: markRaw(makeTank(s)), // (the tank itself is not reactive: it moves sixty times a second – the page reads it on its own beat)
         mine, away: 0, error: '', saving: false, dirty: false, won: [], level: null }) as Game
        if (mine) { g.away = catchUp(s); fillQuests(s); if (g.away || s.quests.length) g.dirty = true; newTrophies(s) } // (what the fish made while I was gone; the quests ready)
        games.set(id, g)
        tankVersion.n++
        if (g.dirty) scheduleSave(id)
        return g
      } catch { return null } finally { loading.delete(id) }
    })()
    loading.set(id, p)
  }
  return p
}
/** Another room: what is not saved goes first (while the server still knows which room it is), then the tanks are let go. */
export async function leaveGames(): Promise<void> {
  await Promise.all([...games.keys()].map((id) => saveGame(id)))
  games.clear()
  tankVersion.n++
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
export function scheduleSave(id: string, ms = 8000): void {
  const g = games.get(id)
  if (!g?.mine) return
  g.dirty = true
  if (timers.has(id)) return
  timers.set(id, setTimeout(() => { timers.delete(id); void saveGame(id) }, ms))
}
export async function saveGame(id: string): Promise<void> {
  const g = games.get(id)
  clearTimeout(timers.get(id)); timers.delete(id)
  if (!g?.mine || !g.dirty) return
  g.dirty = false
  g.saving = true
  g.tank.s.last = Date.now()
  try { await api('mod_game_save', { id, state: toSaved(g.tank.s) as unknown as Record<string, unknown> }); g.error = '' } catch (e) { g.error = errorMessage(e); g.dirty = true } finally { g.saving = false }
}
/** Leaving the page: whatever is not saved yet goes now (a keepalive request outlives the page). */
function flushAll(): void {
  for (const [id, g] of games) {
    if (!g.mine || !g.dirty) continue
    g.tank.s.last = Date.now()
    try { void fetch('api.php?action=mod_game_save', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'X-Niben': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ id, state: toSaved(g.tank.s) }) }) } catch { /* nothing to do */ }
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') for (const id of games.keys()) void saveGame(id) })
}

/** The trophy standing in the room already (its decor item), if it is. */
export const trophyItem = (id: string, tid: string) => decor.items.find((i) => i.trophy === `${id}:${tid}`)
/** Puts a won trophy in the room as a cup (saved first, so the server can see it is won). */
export async function placeTrophy(id: string, tid: string): Promise<string> {
  const tr = trophyOf(tid)
  if (!tr) return 'Fant ikke trofeet.'
  const g = games.get(id)
  if (g) { g.dirty = true; await saveGame(id) }
  try {
    await api('mod_trophy', { id, trophy: tid, tier: tr.tier, name: tr.name })
    await loadDecor()
    return ''
  } catch (e) { return errorMessage(e) }
}
