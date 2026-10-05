import { watch } from 'vue'
import { spotify, control, lockLeft, notify } from './useSpotify'
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
    if (!admin.loggedIn || !spotify.now?.name) return
    if (e.target.closest?.('input, textarea, select, [contenteditable], button, a') || e.metaKey || e.ctrlKey || e.altKey) return
    // only where the music lives (the listening corner / the player) – other pages keep their own keys
    if (!/#\/(lytte|musicplayer)/.test(location.hash)) return
    if (e.code === 'Space') { e.preventDefault(); toggle() }
    else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); guarded('next') }
    else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); guarded('previous') }
  })
}
