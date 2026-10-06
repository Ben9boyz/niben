import { reactive } from 'vue'
import { api } from './useAdmin'

// The rooms to choose between: mine first, then every approved user's. Which one is shown is kept in a cookie by the
// server (room_set), so every request – content, Japanese, Steam … – is about that room. Switching starts the page over.
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

export async function setRoom(username: string): Promise<void> {
  await api('room_set', { username })
  location.hash = '#/'
  location.reload()
}
