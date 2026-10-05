import { Play, Pause, ListEnd, ListPlus, FolderInput, ExternalLink, Link, User, Disc3, Heart, HeartOff, FolderOpen } from 'lucide-vue-next'
import { spotify, play, control, lockLeft, fmtClock, lockNote, notify, enqueue, enqueueAlbum, addToPlaylist, isSaved, toggleAlbumSaved, isLiked, setLiked, addGuest } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { groups, flatGroups, moveTo } from '../composables/useGroups'
import { openAlbumPage, openArtistPage, albumOfTrack, firstArtist } from '../composables/useBrowse'

// What the right-click menu offers on an album, a playlist or a song – the things Spotify has there.
const say = (o) => { spotify.notice = { ...o, t: Date.now() } }
const idOf = (uri) => String(uri || '').split(':')[2]
const typeOf = (uri) => String(uri || '').split(':')[1]
export const webUrl = (uri) => `https://open.spotify.com/${typeOf(uri)}/${idOf(uri)}`
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); say({ text: done }) } catch { say({ error: true, text: 'Klarte ikke å kopiere.' }) }
}

/** Plays an album / playlist from its first song – or pauses / resumes it when it is what's playing. */
export async function playItem(it) {
  if (!admin.loggedIn) return
  const here = spotify.now?.context === it.uri
  if (here) { const r = await control(spotify.now.playing ? 'pause' : 'resume'); if (!r.ok) say({ error: true, text: r.error }); return }
  if (lockLeft.value > 0) return say({ error: true, text: `Låst – hør ferdig (${fmtClock(lockLeft.value)} igjen)` })
  const r = await play(it.uri)
  say(r.ok ? { text: `Spiller «${it.name}»${lockNote()}` } : { error: true, text: r.error })
}

/** Menu for an album or playlist tile. `it`: { uri, name, sub?, image? }; `open` opens it. */
export function itemMenu(it, open) {
  const isAlbum = typeOf(it.uri) === 'album'
  const here = spotify.now?.context === it.uri
  const own = isAlbum ? spotify.albums.some((a) => a.uri === it.uri) : spotify.playlists.some((p) => p.uri === it.uri)
  const items = []
  if (admin.loggedIn) {
    items.push({ label: here && spotify.now?.playing ? 'Pause' : 'Spill', icon: here && spotify.now?.playing ? Pause : Play, run: () => playItem(it) })
    items.push({ label: 'Legg i køen', icon: ListEnd, run: () => enqueueAlbum(it.uri, it.name) })
  }
  items.push({ label: isAlbum ? 'Åpne albumet' : 'Åpne spillelisten', icon: FolderOpen, run: open })
  if (isAlbum && it.sub) items.push({ label: 'Gå til artist', icon: User, run: () => openArtistPage({ id: it.artist_id, name: firstArtist(it.sub) }) })
  // like an album = save it in the library (right-click, no heart on the tile)
  if (admin.loggedIn && isAlbum) {
    const saved = isSaved(it.uri)
    items.push({ label: saved ? 'Fjern fra biblioteket' : 'Lagre i biblioteket', icon: saved ? HeartOff : Heart, run: () => toggleAlbumSaved({ uri: it.uri, name: it.name, artist: it.sub, image: it.image, image_large: it.image, thumb: it.image }) })
  }
  if (admin.loggedIn && own && groups.on && groups.loaded) {
    items.push({ sep: true })
    items.push({ label: 'Flytt til mappe', icon: FolderInput, sub: flatGroups().map((g) => ({ label: `${g.depth ? '↳ ' : ''}${g.name}`, run: async () => { const r = await moveTo(it.uri, g.id); if (!r.ok) say({ error: true, text: r.error }) } })) })
  }
  items.push({ sep: true })
  items.push({ label: 'Åpne i Spotify', icon: ExternalLink, run: () => window.open(webUrl(it.uri), '_blank', 'noopener') })
  items.push({ label: 'Kopier lenke', icon: Link, run: () => copy(webUrl(it.uri), 'Lenken er kopiert.') })
  return items
}

/** Menu for a song (a row in an album / playlist / search). `t` is the track object from the server. */
export function trackMenu(t, { onPlay, albumUri, playlists = true } = {}) {
  const items = []
  const album = t.album_uri ? albumOfTrack(t) : null
  if (admin.loggedIn) {
    items.push({ label: spotify.now?.uri === t.uri && spotify.now?.playing ? 'Pause' : 'Spill', icon: spotify.now?.uri === t.uri && spotify.now?.playing ? Pause : Play, run: onPlay })
    items.push({ label: 'Spill etterpå (legg i køen)', icon: ListEnd, run: () => enqueue(t) })
    if (playlists) {
      items.push({
        label: 'Legg til i spilleliste', icon: ListPlus,
        sub: spotify.playlists.filter((p) => p.editable !== false).map((p) => ({ label: p.name, img: p.thumb || p.image, run: async () => { const r = await addToPlaylist(p.uri, t.uri); say(r.ok ? { text: `«${t.name}» er lagt til i «${p.name}».` } : { error: true, text: r.error }) } })),
      })
    }
    items.push({ label: 'Lagre i Likte sanger', icon: Heart, run: async () => { const liked = await isLiked(t.uri); setLiked(t.uri, !liked) } })
    items.push({ sep: true })
  }
  if (album && album.uri !== albumUri) items.push({ label: 'Gå til album', icon: Disc3, run: () => openAlbumPage(album) })
  if (t.artist) items.push({ label: 'Gå til artist', icon: User, run: () => openArtistPage({ id: t.artist_id, name: firstArtist(t.artist) }) })
  items.push({ sep: true })
  items.push({ label: 'Åpne i Spotify', icon: ExternalLink, run: () => window.open(webUrl(t.uri), '_blank', 'noopener') })
  items.push({ label: 'Kopier lenke', icon: Link, run: () => copy(webUrl(t.uri), 'Lenken er kopiert.') })
  return items
}
