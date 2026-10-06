import { reactive } from 'vue'
import { api, checkLogin } from './useAdmin'
import { reloadData } from './useData'
import { spotify, resetSpotify, refreshLists, refreshNow } from './useSpotify'
import { groups, resetGroups, loadGroups } from './useGroups'
import { discover, resetDiscover, loadDiscover } from './useDiscover'
import { milestones, resetMilestones, loadMilestones } from './useMilestones'
import { jp, resetJapanese, loadJapanese } from './useJapanese'
import { steam, resetSteam, loadSteam } from './useSteam'
import { decor, resetDecor, loadDecor } from './useDecor'
import { live, resetLive, loadLive } from './useLive'
import { myQueue, resetQueue, loadMyQueue } from './useQueue'
import { resetDaily, loadDaily } from './useDaily'
import { peekClear } from './useBrowse'
import { room, clearSelection } from './useRoom'

// The rooms to choose between: mine first, then every approved user's. Which one is shown is kept in a cookie by the
// server (room_set), so every request – content, Japanese, Steam … – is about that room. Switching does NOT reload the
// page: the room flies off, everything that belonged to it is reset and fetched again for the new room, and the new
// one flies in (the 3D scene stays loaded – it only gets new data).
export interface RoomInfo { username: string; owner: boolean; photo: string | null; tagline: string }
export const rooms = reactive({ list: [] as RoomInfo[], current: null as string | null, loaded: false })

export async function loadRooms(): Promise<void> {
  try {
    const r = await api<{ rooms: RoomInfo[]; current: string | null }>('rooms')
    rooms.list = r.rooms
    rooms.current = r.current
  } catch { /* no server: only one room */ }
  rooms.loaded = true
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const frames = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
let switching = false

/** Forget the room we leave and fetch what the new one needs – only the parts that were in use. */
async function swapRoomState(): Promise<void> {
  const used = { groups: groups.loaded, discover: discover.loaded, milestones: milestones.loaded, jp: jp.loaded, steam: steam.loaded, decor: decor.loaded, live: live.loaded, queue: myQueue.loaded, lists: spotify.loaded }
  resetSpotify(); resetGroups(); resetDiscover(); resetMilestones(); resetJapanese(); resetSteam(); resetDecor(); resetLive(); resetQueue(); resetDaily(); peekClear()
  clearSelection(); room.shelfQ = ''; room.peekIndex = 0 // (no record held up from the other room)
  await checkLogin() // (is the new room mine?)
  await Promise.all([
    reloadData(),
    loadRooms(),
    used.lists ? Promise.all([refreshLists(true), refreshNow()]) : undefined,
    used.groups ? loadGroups(true) : undefined,
    used.discover ? loadDiscover() : undefined,
    used.milestones ? loadMilestones(true) : undefined,
    used.jp ? loadJapanese(true) : undefined,
    used.steam ? loadSteam(true) : undefined,
    used.decor ? loadDecor() : undefined,
    used.live ? loadLive() : undefined,
    used.queue ? loadMyQueue() : undefined,
    loadDaily(true),
  ])
}

export async function setRoom(username: string): Promise<void> {
  if (switching || username === rooms.current) return
  switching = true
  const root = document.documentElement
  root.dataset.roomfx = 'out' // the room flies off (style.css)
  try {
    await Promise.all([api('room_set', { username }), wait(430)])
    await swapRoomState()
    location.hash = '#/'
    root.dataset.roomfx = 'pre' // out of sight on the other side …
    await frames()
    root.dataset.roomfx = 'in' // … and in
    await wait(700)
  } catch {
    location.reload() // anything odd: the safe way, a fresh page
    return
  } finally {
    delete root.dataset.roomfx
    switching = false
  }
}
