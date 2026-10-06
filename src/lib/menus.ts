import { Play, Pause, ListEnd, ListPlus, FolderInput, ExternalLink, Link, User, Disc3, Heart, HeartOff, FolderOpen, EyeOff, Trash2 } from 'lucide-vue-next'
import { deletePlaylist, spotify, play, control, lockLeft, fmtClock, lockNote, notify, enqueue, enqueueAlbum, addToPlaylist, isSaved, toggleAlbumSaved, isLiked, setLiked, addGuest } from '../composables/useSpotify'
import type { Album, Track } from '../types'
import { admin } from '../composables/useAdmin'
import type { MenuEntry } from '../composables/useContextMenu'
import { askNewPlaylist } from '../composables/usePlaylistDialog'
import { groups, flatGroups, moveTo } from '../composables/useGroups'
import { openAlbumPage, openArtistPage, albumOfTrack, firstArtist } from '../composables/useBrowse'

// What the right-click menu offers on an album, a playlist or a song – the things Spotify has there.
const say = (o: { text: string; error?: boolean }): void => { spotify.notice = { text: o.text, error: !!o.error, t: Date.now() } }
const idOf = (uri: string | null | undefined): string => String(uri ?? '').split(':')[2] ?? ''
const typeOf = (uri: string | null | undefined): string => String(uri ?? '').split(':')[1] ?? ''
export const webUrl = (uri: string): string => `https://open.spotify.com/${typeOf(uri)}/${idOf(uri)}`
async function copy(text: string, done: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); say({ text: done }) } catch { say({ error: true, text: 'Klarte ikke å kopiere.' }) }
}

/** Plays an album / playlist from its first song – or pauses / resumes it when it is what's playing. */
/** An album or a playlist tile, as far as the menus care. */
export interface MenuItem { uri: string; name: string; sub?: string | null; image?: string | null; artist_id?: string | null; onHide?: () => void }

export async function playItem(it: { uri: string; name: string }): Promise<void> {
  if (!admin.mine) return
  const here = spotify.now?.context === it.uri
  if (here) { const r = await control(spotify.now?.playing ? 'pause' : 'resume'); if (!r.ok) say({ error: true, text: r.error ?? 'Noe gikk galt.' }); return }
  if (lockLeft.value > 0) return say({ error: true, text: `Låst – hør ferdig (${fmtClock(lockLeft.value)} igjen)` })
  const r = await play(it.uri)
  say(r.ok ? { text: `Spiller «${it.name}»${lockNote()}` } : { error: true, text: r.error ?? 'Noe gikk galt.' })
}

/** Opens the "Ny spilleliste" sheet (name + picture). Returns the new playlist, or null if I backed out. */
export const promptNewPlaylist = askNewPlaylist
/** Right-click in the empty space of the playlists: make a new one. */
export function playlistsMenu(): MenuEntry[] {
  return admin.mine ? [{ label: 'Ny spilleliste …', icon: ListPlus, run: promptNewPlaylist }] : []
}

/** Menu for an album or playlist tile. `it`: { uri, name, sub?, image? }; `open` opens it. */
export function itemMenu(it: MenuItem, open: () => void): MenuEntry[] {
  const isAlbum = typeOf(it.uri) === 'album'
  const here = spotify.now?.context === it.uri
  const own = isAlbum ? spotify.albums.some((a) => a.uri === it.uri) : spotify.playlists.some((p) => p.uri === it.uri)
  const items: MenuEntry[] = []
  if (admin.mine) {
    items.push({ label: here && spotify.now?.playing ? 'Pause' : 'Spill', icon: here && spotify.now?.playing ? Pause : Play, run: () => playItem(it) })
    items.push({ label: 'Legg i køen', icon: ListEnd, run: () => enqueueAlbum(it.uri, it.name) })
    if (it.onHide) items.push({ label: 'Skjul dette forslaget', icon: EyeOff, run: it.onHide })
  }
  items.push({ label: isAlbum ? 'Åpne albumet' : 'Åpne spillelisten', icon: FolderOpen, run: open })
  if (isAlbum && it.sub) items.push({ label: 'Gå til artist', icon: User, run: () => openArtistPage({ id: it.artist_id, name: firstArtist(it.sub) }) })
  // like an album = save it in the library (right-click, no heart on the tile)
  if (admin.mine && isAlbum) {
    const saved = isSaved(it.uri)
    items.push({ label: saved ? 'Fjern fra biblioteket' : 'Lagre i biblioteket', icon: saved ? HeartOff : Heart, run: () => toggleAlbumSaved({ uri: it.uri, name: it.name, artist: it.sub ?? '', image: it.image, image_large: it.image, thumb: it.image }) })
  }
  if (admin.mine && !isAlbum && own) {
    items.push({ sep: true })
    items.push({ label: 'Slett spillelisten', icon: Trash2, run: () => { if (window.confirm(`Slette «${it.name}»? Den tas ut av biblioteket ditt på Spotify.`)) deletePlaylist(it.uri, it.name) } })
  }
  if (admin.mine && own && groups.on && groups.loaded) {
    items.push({ sep: true })
    items.push({ label: 'Flytt til mappe', icon: FolderInput, sub: flatGroups().map((g) => ({ label: `${g.depth ? '↳ ' : ''}${g.name}`, run: async () => { const r = await moveTo(it.uri, g.id); if (!r.ok) say({ error: true, text: r.error ?? 'Noe gikk galt.' }) } })) })
  }
  items.push({ sep: true })
  items.push({ label: 'Åpne i Spotify', icon: ExternalLink, run: () => { window.open(webUrl(it.uri), '_blank', 'noopener') } })
  items.push({ label: 'Kopier lenke', icon: Link, run: () => copy(webUrl(it.uri), 'Lenken er kopiert.') })
  return items
}

/** Menu for a song (a row in an album / playlist / search). `t` is the track object from the server. */
export function trackMenu(t: Track, { onPlay, albumUri, playlists = true }: { onPlay?: () => void; albumUri?: string; playlists?: boolean } = {}): MenuEntry[] {
  const items: MenuEntry[] = []
  const album = t.album_uri ? albumOfTrack(t) : null
  if (admin.mine) {
    items.push({ label: spotify.now?.uri === t.uri && spotify.now?.playing ? 'Pause' : 'Spill', icon: spotify.now?.uri === t.uri && spotify.now?.playing ? Pause : Play, run: onPlay })
    items.push({ label: 'Spill etterpå (legg i køen)', icon: ListEnd, run: () => enqueue(t) })
    if (playlists) {
      items.push({
        label: 'Legg til i spilleliste', icon: ListPlus,
        sub: [{ label: '＋ Ny spilleliste …', run: async () => { const p = await promptNewPlaylist(); if (p) { const r = await addToPlaylist(p.uri, t.uri); say(r.ok ? { text: `«${t.name}» er lagt til i «${p.name}».` } : { error: true, text: r.error ?? 'Noe gikk galt.' }) } } }, ...spotify.playlists.filter((p) => p.editable !== false).map((p) => ({ label: p.name, img: p.thumb || p.image, run: async () => { const r = await addToPlaylist(p.uri, t.uri); say(r.ok ? { text: `«${t.name}» er lagt til i «${p.name}».` } : { error: true, text: r.error ?? 'Noe gikk galt.' }) } }))],
      })
    }
    items.push({ label: 'Lagre i Likte sanger', icon: Heart, run: async () => { const liked = await isLiked(t.uri); setLiked(t.uri, !liked) } })
    items.push({ sep: true })
  }
  if (album && album.uri !== albumUri) items.push({ label: 'Gå til album', icon: Disc3, run: () => openAlbumPage(album) })
  if (t.artist) items.push({ label: 'Gå til artist', icon: User, run: () => openArtistPage({ id: t.artist_id, name: firstArtist(t.artist) }) })
  items.push({ sep: true })
  items.push({ label: 'Åpne i Spotify', icon: ExternalLink, run: () => { window.open(webUrl(t.uri), '_blank', 'noopener') } })
  items.push({ label: 'Kopier lenke', icon: Link, run: () => copy(webUrl(t.uri), 'Lenken er kopiert.') })
  return items
}
