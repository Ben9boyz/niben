import { reactive } from 'vue'

// The main tabs and the sub-tabs inside them. Every sub-tab is still its own route (and its own
// station in the 3D room); a group just decides which tab lights up in the menu and which pills show.
export const GROUPS = [
  { id: 'hjem', label: 'Hjem', routes: ['hjem'], icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'lytte', label: 'Lytte', routes: ['lytte'], icon: 'M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { id: 'lare', label: 'Lære', routes: ['japansk', 'ovelse'], icon: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5' },
  { id: 'laget', label: 'Laget', routes: ['gitar', 'kode'], icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' },
  { id: 'opplevd', label: 'Opplevd', routes: ['reiser', 'boker', 'gaming'], icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z' },
  { id: 'om', label: 'Om meg', routes: ['om'], icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' },
]

/** Names of the sub-tabs (only groups with more than one route show them). */
export const TAB_LABELS = { japansk: 'Japansk', ovelse: 'Gitar-øving', gitar: 'Gitarer', kode: 'Prosjekter', reiser: 'Reiser', boker: 'Bøker', gaming: 'Spill' }

const byRoute = new Map(GROUPS.flatMap((g) => g.routes.map((r) => [r, g])))
export const groupOf = (routeName) => byRoute.get(routeName) || null

// the tab you were last on inside each group – the menu takes you back there
const last = reactive(new Map()) // reactive: the menu links update when it changes
export const rememberTab = (routeName) => { const g = byRoute.get(routeName); if (g) last.set(g.id, routeName) }
export const groupTarget = (g) => ({ name: last.get(g.id) || g.routes[0] })
