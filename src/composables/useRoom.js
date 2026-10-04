import { reactive } from 'vue'

// Shared UI ↔ 3D state: what is selected in the room and what the pointer is over.
export const room = reactive({
  ready: false,
  api: null,
  sel: { gitar: -1, bok: -1, land: null, prosjekt: 0, musikk: null },
  hover: null,
  musicView: 'vinyl', // listening station: 'vinyl' | 'spiller' (record on, turntable view) | 'ipod' (in hand) | 'ipodDock' (playlist on, iPod on its stand)
  // what the iPod shows – shared with the panel so the two mirror each other
  ipod: { view: 'menu', playlist: null, active: 0 },
  panelHidden: false, // desktop: the side panel slid away (the 3D view gets the whole screen)
})

export function clearSelection() {
  room.sel.gitar = -1
  room.sel.bok = -1
  room.sel.land = null
  room.sel.musikk = null
  room.musicView = 'vinyl'
  room.ipod.view = 'menu'
  room.ipod.playlist = null
  room.ipod.active = 0
}
