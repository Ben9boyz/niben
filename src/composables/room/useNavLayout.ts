import { computed, ref } from 'vue'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { reloadData, useData, type NavLayout, type NavTab, type SectionId } from '@/composables/site/useData'
import { placed } from '@/composables/room/useModules'
import { GROUPS, HOBBY, standardGroups } from '@/lib/nav'
import { ROUTE_SECTION } from '@/lib/sections'

// The room's menu as something to edit: which tabs, called what, and which pages and hobbies sit under each. It is always
// worked out from what is saved (data.nav) and what the room has, so a new hobby or a corner switched on finds its place by
// itself. Every change goes straight into the menu on screen and is saved a moment later – there is no "Lagre" to forget.
const data = useData()
export const HIDE = '__skjult'

/** A page that is a whole corner of the room of its own (hiding it from the menu switches the corner off). */
export const ownsCorner = (r: string): boolean => ROUTE_SECTION[r] === r
const sectionOff = (r: string): boolean => ownsCorner(r) && (data.profile.sections as Record<string, boolean | undefined>)[r] === false

/** Every page that can be in the menu (Hjem and the hall always are): the built-in ones – also those switched off – and every hobby. */
export const allPages = computed<string[]>(() => {
  const out: string[] = []
  for (const g of GROUPS) if (g.id !== 'hjem' && g.id !== 'gangen' && g.id !== 'hobby') for (const r of g.routes) if (r !== 'vurderinger' || placed.value.some((m) => m.kind.fields.some((f) => f.kind === 'rating'))) out.push(r)
  for (const m of placed.value) out.push(HOBBY + m.id)
  return out
})

function build(): NavLayout {
  const base: NavLayout = data.nav
    ? { tabs: data.nav.tabs.map((t) => ({ ...t, routes: [...t.routes] })), hidden: [...data.nav.hidden] }
    : { tabs: standardGroups.value.filter((g) => g.id !== 'hjem' && g.id !== 'gangen').map((g) => ({ id: g.id.replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'fane', label: g.label, icon: g.glyph ?? '', routes: [...g.routes] })), hidden: [] }
  const seen = new Set([...base.tabs.flatMap((t) => t.routes), ...base.hidden])
  for (const r of allPages.value) {
    if (seen.has(r)) continue
    if (sectionOff(r)) { base.hidden.push(r); continue }
    const std = standardGroups.value.find((g) => g.routes.includes(r))
    const tab = base.tabs.find((t) => t.id === std?.id) ?? base.tabs[base.tabs.length - 1]
    if (tab) tab.routes.push(r); else base.hidden.push(r)
  }
  const exists = new Set(allPages.value) // (a removed hobby is left out)
  for (const t of base.tabs) t.routes = t.routes.filter((r) => exists.has(r))
  base.hidden = base.hidden.filter((r) => exists.has(r))
  return base
}
/** The menu as it stands – read-only; change it with the functions below. */
export const layout = computed<NavLayout>(build)
/** The tab a page sits under, or HIDE. */
export const tabOfPage = (r: string): string => layout.value.tabs.find((t) => t.routes.includes(r))?.id ?? HIDE
/** The standard tab a page belongs to (where it goes back to). */
export const homeTab = (r: string): string => { const id = standardGroups.value.find((g) => g.routes.includes(r))?.id; return layout.value.tabs.find((t) => t.id === id)?.id ?? layout.value.tabs[0]?.id ?? HIDE }

export const navSave = ref<{ busy: boolean; ok: boolean; error: string }>({ busy: false, ok: false, error: '' })
let timer: ReturnType<typeof setTimeout> | undefined
function edit(fn: (L: NavLayout) => void, now = false): Promise<void> {
  const L = build()
  fn(L)
  data.nav = L // (the menu on screen follows at once)
  navSave.value = { busy: true, ok: false, error: '' }
  clearTimeout(timer)
  return new Promise((done) => { timer = setTimeout(() => { void save().then(done) }, now ? 0 : 700) })
}
async function save(): Promise<void> {
  const L = data.nav
  if (!L) return
  try {
    const res = await api<{ nav: NavLayout | null }>('about_nav', { tabs: L.tabs, hidden: L.hidden })
    // a whole corner hidden from the menu is switched off in the room as well – and on again when it gets a tab
    const sections: Partial<Record<SectionId, boolean>> = {}
    for (const r of allPages.value) if (ownsCorner(r)) { const off = L.hidden.includes(r); if (off !== sectionOff(r)) sections[r as SectionId] = !off }
    if (Object.keys(sections).length) { await api('me_settings', { sections }); await reloadData() } else if (res.nav && data.nav === L) data.nav = res.nav
    navSave.value = { busy: false, ok: true, error: '' }
  } catch (e) { navSave.value = { busy: false, ok: false, error: errorMessage(e) } }
}

export function movePage(r: string, where: string, now = false): Promise<void> {
  return edit((L) => {
    for (const t of L.tabs) t.routes = t.routes.filter((x) => x !== r)
    L.hidden = L.hidden.filter((x) => x !== r)
    if (where === HIDE) L.hidden.push(r)
    else L.tabs.find((t) => t.id === where)?.routes.push(r)
  }, now)
}
export const nudgePage = (r: string, d: -1 | 1): Promise<void> => edit((L) => {
  const t = L.tabs.find((x) => x.routes.includes(r)); if (!t) return
  const i = t.routes.indexOf(r), j = i + d
  if (j >= 0 && j < t.routes.length) [t.routes[i], t.routes[j]] = [t.routes[j]!, t.routes[i]!]
})
export const setTab = (id: string, patch: Partial<Pick<NavTab, 'label' | 'icon'>>): Promise<void> => edit((L) => { const t = L.tabs.find((x) => x.id === id); if (t) Object.assign(t, patch) })
export const moveTab = (id: string, d: -1 | 1): Promise<void> => edit((L) => { const i = L.tabs.findIndex((t) => t.id === id), j = i + d; if (i >= 0 && j >= 0 && j < L.tabs.length) [L.tabs[i], L.tabs[j]] = [L.tabs[j]!, L.tabs[i]!] })
export function addTab(): string {
  const id = 't' + Math.random().toString(36).slice(2, 8)
  void edit((L) => { L.tabs.push({ id, label: 'Ny fane', icon: 'Star', routes: [] }) })
  return id
}
/** Taking a tab away: what was under it goes back to where it would have stood. */
export const removeTab = (id: string): Promise<void> => edit((L) => {
  const t = L.tabs.find((x) => x.id === id); if (!t) return
  L.tabs = L.tabs.filter((x) => x.id !== id)
  for (const r of t.routes) {
    const std = standardGroups.value.find((g) => g.routes.includes(r))?.id
    const dest = L.tabs.find((x) => x.id === std) ?? L.tabs[0]
    if (dest) dest.routes.push(r); else L.hidden.push(r)
  }
}, true)
export async function resetNav(): Promise<void> {
  clearTimeout(timer)
  navSave.value = { busy: true, ok: false, error: '' }
  try { await api('about_nav', { reset: true }); await reloadData(); navSave.value = { busy: false, ok: true, error: '' } } catch (e) { navSave.value = { busy: false, ok: false, error: errorMessage(e) } }
}
