import { reactive } from 'vue'
import { addGuest } from './useSpotify'
import { pget, pset } from '../lib/pcache'

// Spotify-style browsing on the flat music page: a song opens its album, an artist opens their albums.
// The pages stack up, so "back" goes to the one before (and finally to the grid / search you came from).
export const peek = reactive({ stack: [] })

const same = (a, b) => a.kind === b.kind && (a.kind === 'album' ? a.item.uri === b.item.uri : (a.item.id || a.item.name) === (b.item.id || b.item.name))
function push(p) {
  const top = peek.stack[peek.stack.length - 1]
  if (!top || !same(top, p)) peek.stack.push(p)
}
export const openAlbumPage = (item) => { if (!item?.uri) return; addGuest(item); push({ kind: 'album', item }) }
export const openArtistPage = (item) => { if (item?.id || item?.name) push({ kind: 'artist', item: { id: item.id || '', name: item.name || '' } }) }
export const peekBack = () => { peek.stack.pop() }
export const peekClear = () => { peek.stack = [] }

/** A track (from a playlist or from search) → the album it is on. */
export const albumOfTrack = (t) => ({ uri: t.album_uri, name: t.album, artist: t.album_artist || t.artist, image: t.album_image || t.img, image_large: t.album_image_large || t.album_image || t.img, url: t.album_url })
/** The first artist's name of "A, B, C". */
export const firstArtist = (s) => String(s || '').split(',')[0].trim()

export async function fetchArtist({ id, name }) {
  const key = `artist:${id || name.toLowerCase()}`
  const saved = await pget(key, 24 * 3600000) // an artist page is fetched once a day at most
  if (saved) return saved
  const j = await fetchArtistNow({ id, name })
  pset(key, j)
  if (j.id) pset(`artist:${j.id}`, j)
  return j
}
async function fetchArtistNow({ id, name }) {
  const q = id ? `id=${encodeURIComponent(id)}` : `name=${encodeURIComponent(name)}`
  const r = await fetch(`api.php?action=spotify_artist&${q}`, { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Niben': '1' } })
  let j = {}
  try { j = await r.json() } catch {}
  if (!r.ok || j.error) throw new Error(j.error || `Fant ikke artisten (${r.status})`)
  return j
}
