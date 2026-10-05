import { reactive, watch } from 'vue'

// How the library is ordered: albums and playlists each remember their own choice.
// "Nylig lagret" = the album saved most recently first (that is the order Spotify gives).
const KEY = 'niben-sort'
export type SortKind = 'album' | 'all' | 'playlist'
export const OPTIONS: Record<SortKind, [string, string][]> = {
  album: [['added', 'Nylig lagret'], ['az', 'Tittel A–Å'], ['artist', 'Artist A–Å'], ['year', 'Utgivelsesår (nyest)'], ['longest', 'Flest låter'], ['shortest', 'Færrest låter']],
  all: [['az', 'Navn A–Å'], ['albums', 'Album først'], ['lists', 'Spillelister først']], // "Alt": albums and playlists in one pot
  playlist: [['default', 'Som i Spotify'], ['az', 'Navn A–Å'], ['longest', 'Flest låter'], ['shortest', 'Færrest låter']],
}
const read = (): Partial<Record<SortKind, string>> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Record<SortKind, string>> } catch { return {} } }
const saved = read()
const pick = (kind: SortKind, fallback: string): string => { const v = saved[kind]; return v && OPTIONS[kind].some((o) => o[0] === v) ? v : fallback }
export const sort = reactive<Record<SortKind, string>>({ album: pick('album', 'added'), playlist: pick('playlist', 'default'), all: pick('all', 'az') })
watch(sort, () => { try { localStorage.setItem(KEY, JSON.stringify({ album: sort.album, playlist: sort.playlist, all: sort.all })) } catch { /* private mode */ } })

const nb = (a: string | undefined, b: string | undefined): number => String(a ?? '').localeCompare(String(b ?? ''), 'nb')
/** An album or a playlist, as far as sorting cares. */
interface Sortable { name: string; artist?: string; year?: string; tracks?: number | null; count?: number | null; added?: number | null }
/** A sorted copy of the albums / playlists (the original order is kept for everything else). */
export function sorted<T extends Sortable>(kind: SortKind, list: T[]): T[] {
  const how = sort[kind]
  const l = [...list]
  const n = (x: Sortable): number => (typeof x.tracks === 'number' ? x.tracks : typeof x.count === 'number' ? x.count : 0)
  switch (how) {
    case 'az': return l.sort((a, b) => nb(a.name, b.name))
    case 'artist': return l.sort((a, b) => nb(a.artist, b.artist) || nb(a.year, b.year) || nb(a.name, b.name))
    case 'year': return l.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || nb(a.name, b.name))
    case 'longest': return l.sort((a, b) => n(b) - n(a) || nb(a.name, b.name))
    case 'shortest': return l.sort((a, b) => n(a) - n(b) || nb(a.name, b.name))
    case 'added': return l.sort((a, b) => (b.added ?? 0) - (a.added ?? 0)) // equal / missing dates keep Spotify's order (stable sort)
    default: return l
  }
}
