import { watch } from 'vue'
import { spotify, control, lockLeft, notify, setShuffle, cycleRepeat, isLiked, setLiked } from './useSpotify'
import { room } from './useRoom'
import { shortcuts } from './useShortcuts'
import { admin } from './useAdmin'

// What's playing shows up where the system shows music (lock screen, media keys, headphones, the
// browser's media hub), and the keys work there – for me (admin). Plus keyboard shortcuts on the site:
// space = play/pause, shift+→ / shift+← = next / previous.
const ms = typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null

function guarded(op) {
  if (['next', 'previous', 'seek'].includes(op) && lockLeft.value > 0) { notify('Låst – hør ferdig', true); return }
  control(op)
}
function toggle() {
  const n = spotify.now
  if (!n?.name) return
  n.playing = !n.playing
  control(n.playing ? 'resume' : 'pause')
}

export function useMediaSession() {
  if (ms) {
    watch(() => [spotify.now?.uri, spotify.now?.name, spotify.now?.image_large, admin.loggedIn], () => {
      const n = spotify.now
      if (!n?.name || !admin.loggedIn) { ms.metadata = null; return }
      const art = n.image_large || n.image
      ms.metadata = new MediaMetadata({ title: n.name, artist: n.artist || '', album: n.album || '', artwork: art ? [{ src: art, sizes: '640x640', type: 'image/jpeg' }] : [] })
    }, { immediate: true })
    watch(() => spotify.now?.playing, (p) => { ms.playbackState = spotify.now?.name ? (p ? 'playing' : 'paused') : 'none' }, { immediate: true })
    const on = (a, f) => { try { ms.setActionHandler(a, f) } catch {} }
    watch(() => admin.loggedIn, (yes) => {
      on('play', yes ? () => toggle() : null)
      on('pause', yes ? () => toggle() : null)
      on('nexttrack', yes ? () => guarded('next') : null)
      on('previoustrack', yes ? () => guarded('previous') : null)
      on('seekto', yes ? (d) => (lockLeft.value > 0 ? notify('Låst – hør ferdig', true) : control('seek', Math.round((d.seekTime || 0) * 1000))) : null)
    }, { immediate: true })
  }
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target
    if (t.closest?.('input, textarea, select, [contenteditable]')) return
    const onButton = !!t.closest?.('button, a')
    // "?" shows the list of shortcuts, everywhere (also for visitors)
    if (e.key === '?') { e.preventDefault(); shortcuts.open = !shortcuts.open; return }
    if (e.key === 'Escape' && shortcuts.open) { shortcuts.open = false; return }
    if (!admin.loggedIn || !spotify.now?.name) return
    const here = /#\/(lytte|musicplayer)/.test(location.hash) // where the music lives; other pages keep their own keys
    // everywhere: shift + space / shift + arrows
    if (e.shiftKey && e.code === 'Space') { e.preventDefault(); toggle(); return }
    if (e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); guarded('next'); return }
    if (e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); guarded('previous'); return }
    if (!here || e.shiftKey) return
    if (e.code === 'Space') { if (!onButton) { e.preventDefault(); toggle() } return }
    const k = e.key.toLowerCase()
    if (k === 's') { e.preventDefault(); setShuffle(!spotify.now.shuffle) }
    else if (k === 'r') { e.preventDefault(); cycleRepeat() }
    else if (k === 'h') {
      e.preventDefault()
      const uri = spotify.now.uri
      if (uri?.startsWith('spotify:track:')) isLiked(uri).then((l) => setLiked(uri, !l))
    } else if (k === 'f' && room.sel.musikk) { e.preventDefault(); room.recordFlipped = !room.recordFlipped }
    else if (e.key === '/') { const el = document.querySelector('.gsearch input, input[type=search]'); if (el) { e.preventDefault(); el.focus() } }
  })
}
