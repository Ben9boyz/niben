import { reactive } from 'vue'
import type { Playlist } from '@/types'
import type { createRoom } from '@/three/room'

type RoomApi = ReturnType<typeof createRoom>

// Shared UI ↔ 3D state: what is selected in the room and what the pointer is over.
export type MusicView = 'vinyl' | 'spiller' | 'ipod' | 'ipodDock'
export type PracticeTab = 'timer' | 'akkorder' | 'stemmer' | 'metronom'
export type ChordMode = 'bytte' | 'progresjon' | 'sanger' | 'grep'
export type IpodView = 'menu' | 'playlist' | 'queue' | 'now' | string

/** A record (album) picked in the room. */
export interface MusicSelection { kind: 'album' | string; uri: string; t: number }
/** What the pointer rests on in the 3D room (a label that follows it). */
export interface RoomHover { label: string; x: number; y: number; station?: string; country?: string; uri?: string | null }

export const room = reactive({
  ready: false,
  api: null as RoomApi | null,
  sel: {
    gitar: -1,
    bok: -1,
    land: null as string | null,
    prosjekt: 0,
    musikk: null as MusicSelection | null,
  },
  hover: null as RoomHover | null,
  musicView: 'vinyl' as MusicView, // listening station: 'vinyl' | 'spiller' (record on, turntable view) | 'ipod' (in hand) | 'ipodDock' (playlist on, iPod on its stand)
  // what the iPod shows – shared with the panel so the two mirror each other
  ipod: { view: 'menu' as IpodView, playlist: null as Playlist | null, active: 0, q: '' }, // q: the search text, shared by the panel and the iPod screen
  discover: false, // listening corner: the "Oppdag" view (picks + suggestions) is open instead of albums / playlists
  panelHidden: false,
  deckView: false, // listening corner: looking straight down at the turntable – the buttons and the needle can be pressed
  shelfView: false, // listening corner: camera in front of the record shelf
  shelfQ: '', // text typed in the shelf search: matching records slide out of the shelf in the room
  peekIndex: 0, // browsing the shelf: the record pulled out (index into the albums)
  recordFlipped: false, // the held-up record turned over to its track list
  practiceTab: 'timer' as PracticeTab, // practice corner
  chordMode: 'bytte' as ChordMode, // chord practice
  jpAnime: -1, // Japanese corner: the anime DVD pulled out (index into jp.anime)
  jpPractice: false, // Japanese corner: flashcard practice open
})

export function clearSelection(): void {
  room.shelfView = false
  room.deckView = false
  room.recordFlipped = false
  room.jpPractice = false
  room.jpAnime = -1
  room.sel.gitar = -1
  room.sel.bok = -1
  room.sel.land = null
  room.sel.musikk = null
  room.musicView = 'vinyl'
  room.discover = false
  room.ipod.view = 'menu'
  room.ipod.playlist = null
  room.ipod.active = 0
  room.ipod.q = ''
}
