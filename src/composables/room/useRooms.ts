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
import { resetModules } from './useModules'
import { resetStrava } from '@/composables/site/useStrava'

// The rooms to choose between: mine first, then every approved user's. Which one is shown is kept in a cookie by the
// server (room_set), so every request – content, Japanese, Steam … – is about that room. Switching does NOT reload the
// page: the room flies off, everything that belonged to it is reset and fetched again for the new room, and the new
// one flies in (the 3D scene stays loaded – it only gets new data).
export interface RoomInfo { username: string; owner: boolean; photo: string | null; door?: string | null; tagline: string }
export const rooms = reactive({ list: [] as RoomInfo[], total: 0, current: null as string | null, loaded: false })

// The hall: every room has a door, so a page at a time (and a search) – a house with a thousand rooms has to stay quick.
export const hall = reactive({ q: '', offset: 0, limit: 12, items: [] as RoomInfo[], total: 0, busy: false, loaded: false })
let hallSeq = 0
export async function loadHall(): Promise<void> {
  const seq = ++hallSeq
  hall.busy = true
  try {
    const r = await api<{ rooms: RoomInfo[]; total: number }>('rooms_find', { q: hall.q, offset: hall.offset, limit: hall.limit })
    if (seq !== hallSeq) return // (a newer search has been asked for)
    hall.items = r.rooms
    hall.total = r.total
    if (r.rooms.length === 0 && hall.offset > 0) { hall.offset = Math.max(0, (Math.ceil(r.total / hall.limit) - 1) * hall.limit); void loadHall(); return }
  } catch { /* no server: the hall stays as it was */ } finally { if (seq === hallSeq) { hall.busy = false; hall.loaded = true } }
}
let hallTimer = 0
export function searchHall(q: string): void { hall.q = q; hall.offset = 0; clearTimeout(hallTimer); hallTimer = window.setTimeout(() => void loadHall(), 250) }
export function pageHall(dir: 1 | -1): void { hall.offset = Math.max(0, hall.offset + dir * hall.limit); void loadHall() }

export async function loadRooms(): Promise<void> {
  try {
    const r = await api<{ rooms: RoomInfo[]; total?: number; current: string | null }>('rooms')
    rooms.list = r.rooms
    rooms.total = r.total ?? r.rooms.length
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
  resetSpotify(); resetGroups(); resetDiscover(); resetMilestones(); resetJapanese(); resetSteam(); resetDecor(); resetModules(); resetStrava(); resetLive(); resetQueue(); resetDaily(); peekClear()
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
    loadDecor(), // (the hobby modules live in the same list, and the menu needs them)
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

export async function setRoom(username: string, { viaDoor = false }: { viaDoor?: boolean } = {}): Promise<void> {
  if (switching) { queued = username; return }
  if (username === rooms.current) return
  switching = true
  stashRoom(rooms.current ?? '')
  const root = document.documentElement
  if (!viaDoor) root.dataset.roomfx = 'out' // the room flies off (style.css) – unless you walked through its door: then you are simply in it
  try {
    await Promise.all([api('room_set', { username }), wait(viaDoor ? 0 : 320)])
    await swapRoomState(username)
    // stay in the corner you are in – only a corner this room does not have (or the admin of somebody else's room) sends you home
    const here = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
    if (here && ((useData().profile.sections as Record<string, boolean | undefined>)?.[here] === false || (here === 'admin' && !admin.mine))) location.hash = '#/'
    if (!viaDoor) {
      root.dataset.roomfx = 'pre' // out of sight on the other side …
      await frames()
      root.dataset.roomfx = 'in' // … and in
      await wait(450)
    }
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

/** A door in the hall: step into that room (the room flies in as usual) and stand in its overview. */
export async function enterRoom(username: string): Promise<void> {
  // in the 3D hall: up to that room's door, it swings open, and in through it – then the room changes
  const door = username !== rooms.current && !!room.api && location.hash.startsWith('#/gangen') && (await room.api.enterDoor(username))
  if (username !== rooms.current) await setRoom(username, { viaDoor: door })
  if (door) room.api?.arriveInRoom() // (in through the door: you are standing just inside the new room, and look around it)
  if (location.hash !== '#/') location.hash = '#/'
}
