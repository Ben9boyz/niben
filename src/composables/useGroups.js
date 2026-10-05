import { reactive, watch, computed } from 'vue'
import { api } from './useAdmin'
import { spotify } from './useSpotify'
import { room } from './useRoom'
import { pget, pset } from '../lib/pcache'

// My groups ("Jobb og fokus", "Trening" …) for albums and playlists. They live on the server (the same on every
// device); the on/off switch for grouping is per browser. New things get a guessed group, marked as guessed
// until I move or confirm them.
const KEY = 'niben-grouping'
function readOn() {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

const COLLAPSED_KEY = 'niben-groups-collapsed'
function readCollapsed() {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') } catch { return {} }
}
const phone = typeof window !== 'undefined' ? window.matchMedia('(max-width: 820px)') : { matches: false }

const VIEW_KEY = 'niben-grouping-view'
function readView() {
  try { const v = localStorage.getItem(VIEW_KEY); return v === 'lister' || v === 'mapper' ? v : 'artist' } catch { return 'artist' }
}

export const groups = reactive({
  loaded: false,
  list: [], // [{ id, name, parent? }] in the order shown – a group with a parent is a folder inside it (one level)
  sel: null, // the folder picked in the library (null = all)
  collapsed: readCollapsed(), // id -> true / false, set by me (otherwise: open on the PC, only the first open on a phone)
  treeOpen: {}, // the library's folder tree: id -> false when folded in
  assign: {}, // uri -> group id
  auto: [], // uris that only have a guess
  why: {}, // uri -> what the guess was based on (a genre, the sound …)
  audio: null, // 'yes' / 'no': does Spotify give this app the sound data?
  on: readOn(),
  artist: null, // albums by artist: the one picked in the list on the left (null = all)
  view: readView(), // 'mapper' = folders as tiles in the grid (open one to see what's in it) · 'lister' = sections with headings · 'artist' = albums by artist
  editing: false, // admin: move things / edit the groups
})

// the folder I'm in belongs to the list I'm looking at: switching between Album and Spillelister starts at the top
watch(() => room.musicView.startsWith('ipod'), () => { groups.sel = null; groups.artist = null })

export function setView(v) {
  groups.view = v
  groups.sel = null
  groups.artist = null
  try { localStorage.setItem(VIEW_KEY, v) } catch {}
}

export function setGrouping(on) {
  groups.on = on
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch {}
}

function apply(j) {
  if (!j?.groups) return
  groups.list = j.groups
  groups.assign = j.assign || {}
  groups.auto = j.auto || []
  groups.why = j.why || {}
  groups.audio = j.audio ?? null
  groups.loaded = true
  pset('groups', j) // so the next visit starts from this (see loadGroups)
}

let loading = null
export function loadGroups(force = false) {
  if (loading && !force) return loading
  // the groups are changed from here (and saved + cached at once), so ask the server again only every 6 hours
  loading = (async () => {
    if (!force) {
      const saved = await pget('groups', 6 * 3600000)
      if (saved?.groups) { apply(saved); return }
    }
    try {
      const r = await fetch('api.php?action=spotify_groups', { cache: 'no-store' })
      apply(r.ok ? await r.json() : null)
    } catch {}
  })()
  return loading
}

export const groupOf = (uri) => groups.assign[uri] || null
export const topGroups = () => groups.list.filter((g) => !g.parent)
export const childrenOf = (id) => groups.list.filter((g) => g.parent === id)
/** The groups in tree order (a folder right after its parent), for pickers: { id, name, depth }. */
export function flatGroups() {
  return topGroups().flatMap((g) => [{ id: g.id, name: g.name, depth: 0 }, ...childrenOf(g.id).map((c) => ({ id: c.id, name: c.name, depth: 1 }))])
}
export const nameOf = (id) => {
  const g = groups.list.find((x) => x.id === id)
  const par = g?.parent && groups.list.find((x) => x.id === g.parent)
  return g ? (par ? `${par.name} › ${g.name}` : g.name) : ''
}
/** How many of these uris are in a group (and its folders). */
export function countIn(id, uris) {
  const ids = new Set([id, ...childrenOf(id).map((c) => c.id)])
  return uris.filter((u) => ids.has(groups.assign[u])).length
}

/** Is a section folded in? My choice wins; otherwise open on the PC and – on a phone – only the first one. */
export function isCollapsed(id, index = 0) {
  if (id in groups.collapsed) return !!groups.collapsed[id]
  return phone.matches && index > 0
}
export function toggleCollapsed(id, index = 0) {
  groups.collapsed = { ...groups.collapsed, [id]: !isCollapsed(id, index) }
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(groups.collapsed)) } catch {}
}
export function select(id) { groups.sel = groups.sel === id ? null : id }
export function openFolder(id) { groups.sel = id }

/** Move one album / playlist to a group (admin). Shows at once, saved behind it. */
export async function moveTo(uri, id) {
  const before = groups.assign[uri]
  groups.assign[uri] = id
  groups.auto = groups.auto.filter((u) => u !== uri)
  try {
    await api('spotify_groups_save', { assign: { [uri]: id } })
    return { ok: true }
  } catch (e) {
    groups.assign[uri] = before
    return { ok: false, error: e.message }
  }
}

/** Save the list of groups (names / order / added / removed). */
export async function saveGroups(list) {
  try {
    apply(await api('spotify_groups_save', { groups: list }))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** Items split by group in tree order (a folder after its parent). Only the picked folder when one is picked.
 *  Empty groups are left out unless `keepEmpty` (as drop targets). Each: { group, items, depth, label }. */
export function sectionsOf(items, keepEmpty = false, ignoreSel = false) {
  const by = new Map(groups.list.map((g) => [g.id, []]))
  const other = []
  for (const it of items) (by.get(groups.assign[it.uri]) || other).push(it)
  const sel = ignoreSel ? null : groups.sel // (the add-to menus list everything, whichever folder I'm looking in)
  const keep = (g) => !sel || g.id === sel || g.parent === sel
  const out = []
  for (const g of groups.list.filter(keep)) {
    const its = by.get(g.id)
    if (its.length || keepEmpty) out.push({ group: g, items: its, depth: g.parent ? 1 : 0, label: g.parent ? nameOf(g.id) : g.name })
  }
  if (other.length && !sel) out.push({ group: { id: '_', name: 'Uten gruppe' }, items: other, depth: 0, label: 'Uten gruppe' })
  return out
}

// ── the picture on a folder ──
const coverOfUri = (uri) => {
  const x = spotify.albums.find((a) => a.uri === uri) || spotify.playlists.find((p) => p.uri === uri)
  return x ? x.thumb || x.image || null : null
}
/** The items (album / playlist uris) in a group and its folders, albums first. */
export function itemsIn(id) {
  const ids = new Set([id, ...childrenOf(id).map((c) => c.id)])
  return [...spotify.albums, ...spotify.playlists].map((x) => x.uri).filter((u) => ids.has(groups.assign[u]))
}
/** The picture for a group: the one I picked, none, or – automatically – the first cover found in it. */
export function groupCover(id) {
  const g = groups.list.find((x) => x.id === id)
  if (!g || g.cover === 'none') return null
  if (g.cover) return coverOfUri(g.cover)
  for (const u of itemsIn(id)) { const c = coverOfUri(u); if (c) return c }
  return null
}
export { coverOfUri }

// ── the order of the records on the 3D shelf ──
// By artist (A–Å, then year) – the default, whether grouping is on or not. When I've picked "Mapper" for the
// albums, the shelf follows my folders instead (and by artist inside each folder).
const nb = (a, b) => String(a).localeCompare(String(b), 'nb')
export const shelfAlbums = computed(() => {
  const byArtist = [...spotify.albums].sort((a, b) => nb(a.artist || '', b.artist || '') || nb(a.year || '', b.year || '') || nb(a.name, b.name))
  if (!groups.on || !groups.loaded || groups.view === 'artist') return byArtist
  return sectionsOf(byArtist, false, true).flatMap((s) => s.items)
})
