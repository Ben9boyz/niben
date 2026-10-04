import { ref, watch } from 'vue'

// "site" = the whole niben.no; "player" = just the music player (niben.no/#/musicplayer, and the
// "niben musikk" desktop app): the listening corner in 3D or flat, a player bar, no other pages.
// Remembered for the tab/window, so reloading stays in the player.
const KEY = 'niben-shell'
function initial() {
  try { if (sessionStorage.getItem(KEY) === 'player') return 'player' } catch {}
  return window.nibenApp?.kind === 'music' ? 'player' : 'site'
}
export const shell = ref(initial())

function apply(s) {
  document.documentElement.classList.toggle('player-shell', s === 'player')
  try { s === 'player' ? sessionStorage.setItem(KEY, 'player') : sessionStorage.removeItem(KEY) } catch {}
}
apply(shell.value)
watch(shell, apply)

export const enterPlayer = () => (shell.value = 'player')
export const leavePlayer = () => (shell.value = 'site')
