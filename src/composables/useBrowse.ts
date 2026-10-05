import { reactive } from 'vue'
import type { Album, Track } from '../types'
import { addGuest, spotify } from './useSpotify'
import { pget, pset } from '../lib/pcache'

// Spotify-style browsing on the flat music page: a song opens its album, an artist opens their albums.
// The pages stack up, so "back" goes to the one before (and finally to the grid / search you came from).
export interface ArtistRef { id: string; name: string }
export type Page = { kind: 'album'; item: Album } | { kind: 'artist'; item: ArtistRef }
export const peek = reactive<{ stack: Page[] }>({ stack: [] })

const same = (a: Page, b: Page): boolean => a.kind === b.kind && (a.kind === 'album' && b.kind === 'album' ? a.item.uri === b.item.uri : a.kind === 'artist' && b.kind === 'artist' && (a.item.id || a.item.name) === (b.item.id || b.item.name))
function push(p: Page): void {
  const top = peek.stack[peek.stack.length - 1]
  if (!top || !same(top, p)) peek.stack.push(p)
}
export const openAlbumPage = (item: Album | null | undefined): void => { if (!item?.uri) return; addGuest(item); push({ kind: 'album', item }) }
export const openArtistPage = (item: { id?: string | null; name?: string | null } | null | undefined): void => { if (item?.id || item?.name) push({ kind: 'artist', item: { id: item.id ?? '', name: item.name ?? '' } }) }
export const peekBack = (): void => { peek.stack.pop() }
export const peekClear = (): void => { peek.stack = [] }

/** The album / the artist of the song that plays now → their pages (for the cover and the names on "now playing"). */
export function openNowAlbum(): void {
  const n = spotify.now
  if (!n) return
  const uri = n.album_uri || (String(n.context ?? '').startsWith('spotify:album:') ? n.context : null)
  if (uri) openAlbumPage({ uri, name: n.album, artist: n.artist, image: n.image, image_large: n.image_large })
}
export function openNowArtist(): void {
  const n = spotify.now
  if (n?.artist) openArtistPage({ id: n.artist_id, name: String(n.artist).split(',')[0]?.trim() ?? '' })
}

/** A track (from a playlist or from search) → the album it is on. */
export const albumOfTrack = (t: Track): Album => ({ uri: t.album_uri ?? '', name: t.album ?? '', artist: t.album_artist || t.artist || '', image: t.album_image || t.img, image_large: t.album_image_large || t.album_image || t.img, url: t.album_url })
/** The first artist's name of "A, B, C". */
export const firstArtist = (s: string | null | undefined): string => String(s ?? '').split(',')[0]?.trim() ?? ''

/** An artist page: who they are and their albums. */
export interface ArtistInfo { id?: string; name?: string; image?: string | null; genres?: string[]; albums?: Album[]; _empty?: boolean; error?: string }
export async function fetchArtist({ id, name }: ArtistRef): Promise<ArtistInfo> {
  const key = `artist:${id || name.toLowerCase()}`
  const saved = await pget<ArtistInfo>(key, 24 * 3600000) // an artist page is fetched once a day at most
  if (saved) return saved
  const j = await fetchArtistNow({ id, name })
  if (j._empty || !j.albums?.length) return j // nothing found: ask again next time, don't remember it
  void pset(key, j)
  if (j.id) void pset(`artist:${j.id}`, j)
  return j
}
async function fetchArtistNow({ id, name }: ArtistRef): Promise<ArtistInfo> {
  const q = id ? `id=${encodeURIComponent(id)}` : `name=${encodeURIComponent(name)}`
  const r = await fetch(`api.php?action=spotify_artist&${q}`, { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Niben': '1' } })
  let j: ArtistInfo = {}
  try { j = (await r.json()) as ArtistInfo } catch { /* empty reply */ }
  if (!r.ok || j.error) throw new Error(j.error || `Fant ikke artisten (${r.status})`)
  return j
}
