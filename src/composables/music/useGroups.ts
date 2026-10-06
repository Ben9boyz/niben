import { reactive, watch, computed } from 'vue'
import type { Album, Group, Playlist, Result } from '@/types'
import { api, errorMessage } from '@/composables/useAdmin'
import { spotify } from './useSpotify'
import { room } from '@/composables/useRoom'
import { pget, pset } from '@/lib/pcache'
import { roomKey } from '@/lib/room'

// My groups ("Jobb og fokus", "Trening" …) for albums and playlists. They live on the server (the same on every
// device); the on/off switch for grouping is per browser. New things get a guessed group, marked as guessed
// until I move or confirm them.
const onKey = (): string => roomKey('niben-grouping')
function readOn(): boolean {
  try { return localStorage.getItem(onKey()) !== 'off' } catch { return true }
}

const collapsedKey = (): string => roomKey('niben-groups-collapsed')
function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(collapsedKey()) || '{}') as Record<string, boolean> } catch { return {} }
}
const phone = typeof window !== 'undefined' ? window.matchMedia('(max-width: 820px)') : { matches: false }

const viewKey = (): string => roomKey('niben-grouping-view')
export type GroupView = 'artist' | 'lister' | 'mapper'
function readView(): GroupView {
  try { const v = localStorage.getItem(viewKey()); return v === 'lister' || v === 'mapper' ? v : 'artist' } catch { return 'artist' }
}

export const groups = reactive({
  loaded: false,
  list: [] as Group[], // in the order shown – a group with a parent is a folder inside it (one level)
  sel: null as string | null, // the folder picked in the library (null = all)
  collapsed: readCollapsed(), // id -> true / false, set by me (otherwise: open on the PC, only the first open on a phone)
  treeOpen: {} as Record<string, boolean>, // the library's folder tree: id -> false when folded in
  assign: {} as Record<string, string>, // uri -> group id
  auto: [] as string[], // uris that only have a guess
  why: {} as Record<string, string>, // uri -> what the guess was based on (a genre, the sound …)
  audio: null as string | null, // 'yes' / 'no': does Spotify give this app the sound data?
  on: readOn(),
  artist: null as string | null, // albums by artist: the one picked in the list on the left (null = all)
  view: readView(), // 'mapper' = folders as tiles in the grid · 'lister' = sections with headings · 'artist' = albums by artist
  editing: false, // admin: move things / edit the groups
})

/** What spotify_groups / spotify_groups_save answer. */
interface GroupsReply { groups?: Group[]; assign?: Record<string, string>; auto?: string[]; why?: Record<string, string>; audio?: string | null }

// the folder I'm in belongs to the list I'm looking at: switching between Album and Spillelister starts at the top
watch(() => room.musicView.startsWith('ipod'), () => { groups.sel = null; groups.artist = null })

export function setView(v: GroupView): void {
  groups.view = v
  groups.sel = null
  groups.artist = null
  try { localStorage.setItem(viewKey(), v) } catch { /* private mode */ }
}

export function setGrouping(on: boolean): void {
  groups.on = on
  try { localStorage.setItem(onKey(), on ? 'on' : 'off') } catch { /* private mode */ }
}

function apply(j: GroupsReply | null | undefined): void {
  if (!j?.groups) return
  groups.list = j.groups
  groups.assign = j.assign ?? {}
  groups.auto = j.auto ?? []
  groups.why = j.why ?? {}
  groups.audio = j.audio ?? null
  groups.loaded = true
  void pset(roomKey('groups'), j) // so the next visit starts from this (see loadGroups)
}

let loading: Promise<void> | null = null
export function loadGroups(force = false): Promise<void> {
  if (loading && !force) return loading
  // the groups are changed from here (and saved + cached at once), so ask the server again only every 6 hours
  loading = (async () => {
    if (!force) {
      const saved = await pget<GroupsReply>(roomKey('groups'), 6 * 3600000)
      if (saved?.groups) { apply(saved); return }
    }
    try {
      const r = await fetch('api.php?action=spotify_groups', { cache: 'no-store' })
      apply(r.ok ? ((await r.json()) as GroupsReply) : null)
    } catch { /* offline */ }
  })()
  return loading
}

export const groupOf = (uri: string): string | null => groups.assign[uri] ?? null
export const topGroups = (): Group[] => groups.list.filter((g) => !g.parent)
export const childrenOf = (id: string): Group[] => groups.list.filter((g) => g.parent === id)
/** The groups in tree order (a folder right after its parent), for pickers: { id, name, depth }. */
export function flatGroups(): { id: string; name: string; depth: number }[] {
  return topGroups().flatMap((g) => [{ id: g.id, name: g.name, depth: 0 }, ...childrenOf(g.id).map((c) => ({ id: c.id, name: c.name, depth: 1 }))])
}
const nameOf = (id: string): string => {
  const g = groups.list.find((x) => x.id === id)
  const par = g?.parent && groups.list.find((x) => x.id === g.parent)
  return g ? (par ? `${par.name} › ${g.name}` : g.name) : ''
}
/** How many of these uris are in a group (and its folders). */
export function countIn(id: string, uris: string[]): number {
  const ids = new Set([id, ...childrenOf(id).map((c) => c.id)])
  return uris.filter((u) => ids.has(groups.assign[u])).length
}

/** Is a section folded in? My choice wins; otherwise open on the PC and – on a phone – only the first one. */
export function isCollapsed(id: string, index = 0): boolean {
  if (id in groups.collapsed) return !!groups.collapsed[id]
  return phone.matches && index > 0
}
export function toggleCollapsed(id: string, index = 0): void {
  groups.collapsed = { ...groups.collapsed, [id]: !isCollapsed(id, index) }
  try { localStorage.setItem(collapsedKey(), JSON.stringify(groups.collapsed)) } catch { /* private mode */ }
}
export function select(id: string): void { groups.sel = groups.sel === id ? null : id }
export function openFolder(id: string | null): void { groups.sel = id }

/** Move one album / playlist to a group (admin). Shows at once, saved behind it. */
export async function moveTo(uri: string, id: string): Promise<Result> {
  const before = groups.assign[uri]
  groups.assign[uri] = id
  groups.auto = groups.auto.filter((u) => u !== uri)
  try {
    await api('spotify_groups_save', { assign: { [uri]: id } })
    return { ok: true }
  } catch (e) {
    if (before === undefined) delete groups.assign[uri]
    else groups.assign[uri] = before
    return { ok: false, error: errorMessage(e) }
  }
}

/** My own picture on a folder (admin): uploaded, resized by the server. */
export async function uploadGroupImage(id: string, file: File): Promise<Result> {
  try {
    const fd = new FormData()
    fd.append('id', id)
    fd.append('file', file)
    apply(await api<GroupsReply>('spotify_group_image', fd))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** Save the list of groups (names / order / added / removed). */
export async function saveGroups(list: Group[]): Promise<Result> {
  try {
    apply(await api<GroupsReply>('spotify_groups_save', { groups: list }))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** Items split by group in tree order (a folder after its parent). Only the picked folder when one is picked.
 *  Empty groups are left out unless `keepEmpty` (as drop targets). Each: { group, items, depth, label }. */
export interface Section<T> { group: Group; items: T[]; depth: number; label: string }
export function sectionsOf<T extends { uri: string }>(items: T[], keepEmpty = false, ignoreSel = false): Section<T>[] {
  const by = new Map<string, T[]>(groups.list.map((g): [string, T[]] => [g.id, []]))
  const other: T[] = []
  for (const it of items) (by.get(groups.assign[it.uri] ?? '') ?? other).push(it)
  const sel = ignoreSel ? null : groups.sel // (the add-to menus list everything, whichever folder I'm looking in)
  const keep = (g: Group): boolean => !sel || g.id === sel || g.parent === sel
  const out: Section<T>[] = []
  for (const g of groups.list.filter(keep)) {
    const its = by.get(g.id) ?? []
    if (its.length || keepEmpty) out.push({ group: g, items: its, depth: g.parent ? 1 : 0, label: g.parent ? nameOf(g.id) : g.name })
  }
  if (other.length && !sel) out.push({ group: { id: '_', name: 'Uten gruppe' }, items: other, depth: 0, label: 'Uten gruppe' })
  return out
}

// ── the picture on a folder ──
export const coverOfUri = (uri: string): string | null => {
  const x: Album | Playlist | undefined = spotify.albums.find((a) => a.uri === uri) ?? spotify.playlists.find((p) => p.uri === uri)
  return x ? x.thumb || x.image || null : null
}
/** The items (album / playlist uris) in a group and its folders, albums first. */
export function itemsIn(id: string): string[] {
  const ids = new Set([id, ...childrenOf(id).map((c) => c.id)])
  return [...spotify.albums, ...spotify.playlists].map((x) => x.uri).filter((u) => ids.has(groups.assign[u]))
}
/** The picture for a group: the one I picked, none, or – automatically – the first cover found in it. */
export function groupCover(id: string): string | null {
  const g = groups.list.find((x) => x.id === id)
  if (g?.img) return g.img // my own picture
  if (!g || g.cover === 'none') return null
  if (g.cover) return coverOfUri(g.cover)
  for (const u of itemsIn(id)) { const c = coverOfUri(u); if (c) return c }
  return null
}

// ── the order of the records on the 3D shelf ──
// By artist (A–Å, then year) – the default, whether grouping is on or not. When I've picked "Mapper" for the
// albums, the shelf follows my folders instead (and by artist inside each folder).
const nb = (a: string, b: string): number => String(a).localeCompare(String(b), 'nb')
export const shelfAlbums = computed<Album[]>(() => {
  const byArtist = [...spotify.albums].sort((a, b) => nb(a.artist || '', b.artist || '') || nb(a.year || '', b.year || '') || nb(a.name, b.name))
  if (!groups.on || !groups.loaded || groups.view === 'artist') return byArtist
  return sectionsOf(byArtist, false, true).flatMap((s) => s.items)
})

/** Another room: its own folders, and this machine's view settings for that room. */
export function resetGroups(): void {
  Object.assign(groups, { loaded: false, list: [], sel: null, collapsed: readCollapsed(), treeOpen: {}, assign: {}, auto: [], why: {}, audio: null, on: readOn(), artist: null, view: readView(), editing: false })
  loading = null
}
