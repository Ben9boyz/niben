import { reactive } from 'vue'
import { api, checkLogin, admin } from '@/composables/site/useAdmin'
import { reloadData, useData, stashRoom } from '@/composables/site/useData'
import { spotify, resetSpotify, refreshLists, refreshNow } from '@/composables/music/useSpotify'
import { groups, resetGroups, loadGroups } from '@/composables/music/useGroups'
import { discover, resetDiscover, loadDiscover } from '@/composables/music/useDiscover'
import { milestones, resetMilestones, loadMilestones } from '@/composables/site/useMilestones'
import { jp, resetJapanese, loadJapanese } from '@/composables/japan/useJapanese'
import { steam, resetSteam, loadSteam } from '@/composables/site/useSteam'
import { decor, resetDecor, loadDecor } from './useDecor'
import { live, resetLive, loadLive } from './useLive'
import { myQueue, resetQueue, loadMyQueue } from '@/composables/music/useQueue'
import { resetDaily, loadDaily } from '@/composables/music/useDaily'
import { peekClear } from '@/composables/music/useBrowse'
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
let queued: string | null = null // a room asked for while one is still on its way: it comes next

/** Forget the room we leave and fetch what the new one needs – only the parts that were in use. */
async function swapRoomState(to: string): Promise<void> {
  const used = { groups: groups.loaded, discover: discover.loaded, milestones: milestones.loaded, jp: jp.loaded, steam: steam.loaded, decor: decor.loaded, live: live.loaded, queue: myQueue.loaded, lists: spotify.loaded }
  resetSpotify(); resetGroups(); resetDiscover(); resetMilestones(); resetJapanese(); resetSteam(); resetDecor(); resetLive(); resetQueue(); resetDaily(); peekClear()
  clearSelection(); room.shelfQ = ''; room.peekIndex = 0 // (no record held up from the other room)
  // only what the room itself needs to show waits (who is logged in, the content – at once if I have seen the room before);
  // everything else fills in by itself when it arrives
  const later = [
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
  ]
  for (const p of later) void p?.catch(() => undefined)
  await Promise.all([
    checkLogin(), // (is the new room mine?)
    reloadData(to),
  ])
}

export async function setRoom(username: string): Promise<void> {
  if (switching) { queued = username; return }
  if (username === rooms.current) return
  switching = true
  stashRoom(rooms.current ?? '')
  const root = document.documentElement
  root.dataset.roomfx = 'out' // the room flies off (style.css)
  try {
    await Promise.all([api('room_set', { username }), wait(320)])
    await swapRoomState(username)
    // stay in the corner you are in – only a corner this room does not have (or the admin of somebody else's room) sends you home
    const here = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
    if (here && ((useData().profile.sections as Record<string, boolean | undefined>)?.[here] === false || (here === 'admin' && !admin.mine))) location.hash = '#/'
    root.dataset.roomfx = 'pre' // out of sight on the other side …
    await frames()
    root.dataset.roomfx = 'in' // … and in
    await wait(450)
  } catch {
    location.reload() // anything odd: the safe way, a fresh page
    return
  } finally {
    delete root.dataset.roomfx
    switching = false
  }
  const next = queued
  queued = null
  if (next && next !== rooms.current) await setRoom(next)
}
