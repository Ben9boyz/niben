import { reactive, watch } from 'vue'

// How the library is ordered: albums and playlists each remember their own choice.
// "Nylig lagret" = the album saved most recently first (that is the order Spotify gives).
const KEY = 'niben-sort'
export const OPTIONS = {
  album: [['added', 'Nylig lagret'], ['az', 'Tittel A–Å'], ['artist', 'Artist A–Å'], ['year', 'Utgivelsesår (nyest)'], ['longest', 'Flest låter'], ['shortest', 'Færrest låter']],
  playlist: [['default', 'Som i Spotify'], ['az', 'Navn A–Å'], ['longest', 'Flest låter'], ['shortest', 'Færrest låter']],
}
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const saved = read()
export const sort = reactive({ album: saved.album && OPTIONS.album.some((o) => o[0] === saved.album) ? saved.album : 'added', playlist: saved.playlist && OPTIONS.playlist.some((o) => o[0] === saved.playlist) ? saved.playlist : 'default' })
watch(sort, () => { try { localStorage.setItem(KEY, JSON.stringify({ album: sort.album, playlist: sort.playlist })) } catch {} })

const nb = (a, b) => String(a || '').localeCompare(String(b || ''), 'nb')
/** A sorted copy of the albums / playlists (the original order is kept for everything else). */
export function sorted(kind, list) {
  const how = sort[kind]
  const l = [...list]
  const n = (x) => (typeof x.tracks === 'number' ? x.tracks : typeof x.count === 'number' ? x.count : 0)
  switch (how) {
    case 'az': return l.sort((a, b) => nb(a.name, b.name))
    case 'artist': return l.sort((a, b) => nb(a.artist, b.artist) || nb(a.year, b.year) || nb(a.name, b.name))
    case 'year': return l.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || nb(a.name, b.name))
    case 'longest': return l.sort((a, b) => n(b) - n(a) || nb(a.name, b.name))
    case 'shortest': return l.sort((a, b) => n(a) - n(b) || nb(a.name, b.name))
    case 'added': return l.sort((a, b) => (b.added || 0) - (a.added || 0)) // equal / missing dates keep Spotify's order (stable sort)
    default: return l
  }
}
