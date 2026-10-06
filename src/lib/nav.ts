import { computed, reactive } from 'vue'
import { useData } from '@/composables/site/useData'
import { routeAllowed } from './sections'
import { rooms } from '@/composables/room/useRooms'
import { placed } from '@/composables/room/useModules'

// The main tabs and the sub-tabs inside them. Every sub-tab is still its own route (and its own
// station in the 3D room); a group just decides which tab lights up in the menu and which pills show.
export interface NavGroup { id: string; label: string; routes: string[]; icon: string; emoji?: string }
export const GROUPS: NavGroup[] = [
  { id: 'hjem', label: 'Hjem', routes: ['hjem'], icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'lytte', label: 'Lytte', routes: ['lytte'], icon: 'M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { id: 'lare', label: 'Lære', routes: ['japansk', 'ovelse'], icon: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5' },
  { id: 'laget', label: 'Laget', routes: ['gitar', 'figurer', 'kode'], icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' },
  { id: 'opplevd', label: 'Opplevd', routes: ['reiser', 'boker', 'gaming', 'aaret'], icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z' },
  { id: 'hobby', label: 'Hobbyer', routes: [], icon: 'M12 2l2.4 6.9H22l-6 4.4 2.3 7L12 16l-6.3 4.3 2.3-7-6-4.4h7.6z' }, // (its tabs are the room's hobby modules: 'h:<id>')
  { id: 'gangen', label: 'Gangen', routes: ['gangen'], icon: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14.5 12.5h.01' },
  { id: 'om', label: 'Om meg', routes: ['om'], icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' },
]

/** Icons (SVG paths, 24×24) for the sub-tabs. */
export const ROUTE_ICONS: Record<string, string> = {
  japansk: 'M3 5.5c3.5 1.2 14.5 1.2 18 0M5 9.5h14M7.5 6.5V21M16.5 6.5V21M12 6.8v2.7',
  ovelse: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-12v4l2.5 2.5M10 2h4M12 2v3',
  gitar: 'M19.6 2.6l1.8 1.8-2.1 2.1.6.6-1.4 1.4-.6-.6-3.3 3.3a4 4 0 0 1-1 5.2 4.6 4.6 0 0 1-3 4.4 5 5 0 0 1-6.5-6.5 4.6 4.6 0 0 1 4.4-3 4 4 0 0 1 5.2-1l3.3-3.3-.6-.6 1.4-1.4.6.6zM8.5 13a2 2 0 1 0 2.5 2.5',
  figurer: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 21v-5a5 5 0 0 1 10 0v5zM9 21v-2m6 2v-2',
  kode: 'M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16',
  reiser: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3.5 9h17M3.5 15h17',
  boker: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13z',
  aaret: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
  gaming: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.9 7.2A3 3 0 0 0 4.8 19a3 3 0 0 0 2.6-1.5L8 16h8l.6 1.5a3 3 0 0 0 2.6 1.5 3 3 0 0 0 3-3.2l-.9-7.2a4 4 0 0 0-4-3.6z',
}

/** Names of the sub-tabs (only groups with more than one route show them). */
export const TAB_LABELS: Record<string, string> = { japansk: 'Japansk', ovelse: 'Gitar-øving', gitar: 'Gitarer', figurer: 'Figurer', kode: 'Prosjekter', reiser: 'Reiser', boker: 'Bøker', gaming: 'Spill', aaret: 'Året' }

const data = useData()
/** The groups of the room being shown: pages of switched-off corners are left out, and groups with nothing left disappear. */
const BUILTIN = new Set(['lare', 'laget', 'opplevd'])
/** The groups of the room being shown: pages of switched-off corners are left out, and groups with nothing left disappear. A hobby module sits
 *  under the tab its owner chose (Lære, Laget, Opplevd, Hobbyer – or a tab of its own: "Trening" with a swimmer for a symbol). */
export const navGroups = computed<NavGroup[]>(() => {
  const mods = placed.value
  const out: NavGroup[] = GROUPS.map((g) => ({ ...g, routes: g.id === 'hobby' ? [] : g.routes.filter((r) => routeAllowed(r, data.profile)) }))
  const custom = new Map<string, NavGroup>()
  for (const m of mods) {
    const grp = (m.item.grp ?? '').trim()
    const key = HOBBY + m.id
    const target = grp === '' ? out.find((g) => g.id === 'hobby') : BUILTIN.has(grp) ? out.find((g) => g.id === grp) : undefined
    if (target) { target.routes.push(key); continue }
    const id = 'c:' + grp.toLowerCase()
    let g = custom.get(id)
    if (!g) { g = { id, label: grp, routes: [], icon: GROUPS.find((x) => x.id === 'hobby')?.icon ?? '', emoji: m.icon }; custom.set(id, g) }
    g.routes.push(key)
  }
  // a tab of one's own goes in before "Om meg" and the hall
  const at = out.findIndex((g) => g.id === 'gangen')
  out.splice(at < 0 ? out.length : at, 0, ...custom.values())
  return out.filter((g) => g.routes.length > 0 && (g.id !== 'gangen' || rooms.list.length > 1)) // (the hall is only there when there is more than one room)
})
/** A hobby module's tab is called 'h:<id>' (the route itself is /h/<id>). */
export const HOBBY = 'h:'
/** The name a page has in the menu: the route's name, or 'h:<id>' for a hobby module. */
export const routeKey = (r: { name?: unknown; params?: Record<string, unknown> }): string => (r.name === 'modul' ? HOBBY + String(r.params?.id ?? '') : String(r.name))
export const tabLabel = (r: string): string => {
  if (!r.startsWith(HOBBY)) return TAB_LABELS[r] ?? r
  const m = placed.value.find((x) => x.id === r.slice(HOBBY.length))
  return m ? `${m.icon} ${m.name}` : 'Modul'
}
export const tabTarget = (r: string): { name: string; params?: { id: string } } => (r.startsWith(HOBBY) ? { name: 'modul', params: { id: r.slice(HOBBY.length) } } : { name: r })
const byRoute = new Map<string, NavGroup>(GROUPS.flatMap((g) => g.routes.map((r): [string, NavGroup] => [r, g])))
/** The group a page belongs to (`routeName` is the route's name, or 'h:<id>' for a hobby module: see routeKey). */
export const groupOf = (routeName: unknown): NavGroup | null => navGroups.value.find((g) => g.routes.includes(String(routeName))) ?? byRoute.get(String(routeName)) ?? null

// the tab you were last on inside each group – the menu takes you back there
const last = reactive(new Map<string, string>()) // reactive: the menu links update when it changes
export const rememberTab = (routeName: unknown): void => { const g = groupOf(routeName); if (g) last.set(g.id, String(routeName)) }
export const groupTarget = (g: NavGroup): { name: string; params?: { id: string } } => { const l = last.get(g.id); return tabTarget(l && g.routes.includes(l) ? l : g.routes[0] ?? 'hjem') }
