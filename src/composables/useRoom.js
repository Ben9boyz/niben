import { reactive } from 'vue'

// Shared UI ↔ 3D state: what is selected in the room and what the pointer is over.
export const room = reactive({
  ready: false,
  api: null,
  sel: { gitar: -1, bok: -1, land: null, prosjekt: 0, musikk: null },
  hover: null,
  musicView: 'vinyl', // listening station: 'vinyl' | 'spiller' (record on, turntable view) | 'ipod' (in hand) | 'ipodDock' (playlist on, iPod on its stand)
  // what the iPod shows – shared with the panel so the two mirror each other
  ipod: { view: 'menu', playlist: null, active: 0, q: '' }, // q: the search text, shared by the panel and the iPod screen
  panelHidden: false,
  shelfView: false, // listening corner: camera in front of the record shelf
  peekIndex: 0, // browsing the shelf: the record pulled out (index into the albums)
  recordFlipped: false, // the held-up record turned over to its track list
  practiceTab: 'timer', // practice corner: 'timer' | 'akkorder'
  chordMode: 'bytte', // chord practice: 'bytte' | 'progresjon' | 'sanger' | 'grep'
  jpAnime: -1, // Japanese corner: the anime DVD pulled out (index into jp.anime)
  jpPractice: false, // Japanese corner: flashcard practice open // desktop: the side panel slid away (the 3D view gets the whole screen)
})

export function clearSelection() {
  room.shelfView = false
  room.recordFlipped = false
  room.jpPractice = false
  room.jpAnime = -1
  room.sel.gitar = -1
  room.sel.bok = -1
  room.sel.land = null
  room.sel.musikk = null
  room.musicView = 'vinyl'
  room.ipod.view = 'menu'
  room.ipod.playlist = null
  room.ipod.active = 0
  room.ipod.q = ''
}
