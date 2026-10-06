import { watch } from 'vue'
import { spotify, control, lockLeft, notify, setShuffle, cycleRepeat, isLiked, setLiked, toggleAlbumSaved, findAlbum } from './useSpotify'
import { room } from '@/composables/room/useRoom'
import { shortcuts } from '@/composables/useShortcuts'
import { admin } from '@/composables/site/useAdmin'
import { web } from './useWebPlayer'

// What's playing shows up where the system shows music (lock screen, media keys, headphones, the
// browser's media hub), and the keys work there – for me (admin). Plus keyboard shortcuts on the site:
// space = play/pause, shift+→ / shift+← = next / previous.
const ms: MediaSession | null = typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null

function guarded(op: string): void {
  if (['next', 'previous', 'seek'].includes(op) && lockLeft.value > 0) { notify('Låst – hør ferdig', true); return }
  void control(op)
}
function toggle(): void {
  const n = spotify.now
  if (!n?.name) return
  n.playing = !n.playing
  void control(n.playing ? 'resume' : 'pause')
}

// iPhone: when the page itself is the Spotify speaker, the music comes out of Spotify's own little embedded player
// (an iframe), and the lock screen then shows ITS name – "Spotify Embedded Player" – with no cover. To make the page
// the one that owns the lock-screen card, it plays a silent sound of its own while the music plays (the music is
// untouched – this only gives the page a media session to put the cover, title and buttons on).
let anchor: HTMLAudioElement | null = null
function silentWav(): string {
  const n = 8000 // one second, 8 kHz, 8-bit mono
  const b = new Uint8Array(44 + n)
  const dv = new DataView(b.buffer)
  const w = (o: number, t: string): void => { [...t].forEach((c, i) => { b[o + i] = c.charCodeAt(0) }) }
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true)
  b.fill(128, 44) // 128 = silence in 8-bit audio
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }))
}
function syncAnchor(): void {
  const want = admin.mine && web.status === 'ready' && !!spotify.now?.playing
  if (want) {
    if (!anchor) { anchor = new Audio(silentWav()); anchor.loop = true; anchor.setAttribute('playsinline', ''); anchor.volume = 1 }
    anchor.play().catch(() => {}) // (needs a tap first – the first tap on the page arms it)
  } else if (anchor) anchor.pause()
}

export function useMediaSession(): void {
  watch(() => [admin.mine, web.status, spotify.now?.playing], syncAnchor, { immediate: true })
  window.addEventListener('pointerdown', syncAnchor, { passive: true })
  if (ms) {
    watch(() => [spotify.now?.uri, spotify.now?.name, spotify.now?.image_large, admin.mine], () => {
      const n = spotify.now
      if (!n?.name || !admin.mine) { ms.metadata = null; return }
      const art = n.image_large || n.image
      ms.metadata = new MediaMetadata({ title: n.name, artist: n.artist || '', album: n.album || '', artwork: art ? [{ src: art, sizes: '640x640', type: 'image/jpeg' }] : [] })
    }, { immediate: true })
    watch(() => [spotify.now?.uri, spotify.now?.playing, spotify.now?.duration_ms], () => {
      const n = spotify.now
      if (!n?.duration_ms || !admin.mine) return
      try { ms.setPositionState({ duration: n.duration_ms / 1000, playbackRate: 1, position: Math.min(n.duration_ms, n.progress_ms || 0) / 1000 }) } catch { /* not supported */ }
    }, { immediate: true })
    watch(() => spotify.now?.playing, (p) => { ms.playbackState = spotify.now?.name ? (p ? 'playing' : 'paused') : 'none' }, { immediate: true })
    const on = (a: MediaSessionAction, f: MediaSessionActionHandler | null): void => { try { ms.setActionHandler(a, f) } catch { /* not supported */ } }
    watch(() => admin.mine, (yes) => {
      on('play', yes ? () => toggle() : null)
      on('pause', yes ? () => toggle() : null)
      on('nexttrack', yes ? () => guarded('next') : null)
      on('previoustrack', yes ? () => guarded('previous') : null)
      on('seekto', yes ? (d) => { if (lockLeft.value > 0) notify('Låst – hør ferdig', true); else void control('seek', Math.round((d.seekTime ?? 0) * 1000)) } : null)
    }, { immediate: true })
  }
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target instanceof Element ? e.target : null
    if (t?.closest('input, textarea, select, [contenteditable]')) return
    const onButton = !!t?.closest('button, a')
    // "?" shows the list of shortcuts, everywhere (also for visitors)
    if (e.key === '?') { e.preventDefault(); shortcuts.open = !shortcuts.open; return }
    if (e.key === 'Escape' && shortcuts.open) { shortcuts.open = false; return }
    const now = spotify.now
    if (!admin.mine || !now?.name) return
    const here = /#\/(lytte|musicplayer)/.test(location.hash) // where the music lives; other pages keep their own keys
    // everywhere: shift + space / shift + arrows
    if (e.shiftKey && e.code === 'Space') { e.preventDefault(); toggle(); return }
    if (e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); guarded('next'); return }
    if (e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); guarded('previous'); return }
    if (!here || e.shiftKey) return
    if (e.code === 'Space') { if (!onButton) { e.preventDefault(); toggle() } return }
    const k = e.key.toLowerCase()
    if (k === 's') { e.preventDefault(); void setShuffle(!now.shuffle) }
    else if (k === 'r') { e.preventDefault(); void cycleRepeat() }
    else if (k === 'h') {
      e.preventDefault()
      // H: an album that is playing goes into / out of the library; a playlist has no heart; a single song goes into Liked Songs
      const ctx = String(now.context ?? '')
      const uri = now.uri
      if (ctx.startsWith('spotify:album:')) void toggleAlbumSaved(findAlbum(ctx) ?? { uri: ctx, name: now.album || 'Albumet', artist: now.artist, image: now.image, image_large: now.image_large })
      else if (!ctx.startsWith('spotify:playlist:') && uri.startsWith('spotify:track:')) void isLiked(uri).then((l) => setLiked(uri, !l))
    } else if (k === 'f' && room.sel.musikk) { e.preventDefault(); room.recordFlipped = !room.recordFlipped }
    else if (e.key === '/') {
      const el = document.querySelector<HTMLInputElement>('.gsearch input, input[type=search]')
      if (el) { e.preventDefault(); el.focus() }
    }
  })
}
