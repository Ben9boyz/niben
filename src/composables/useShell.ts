import { ref, watch } from 'vue'

// "site" = the whole niben.no; "player" = just the music player (niben.no/#/musicplayer, and the
// "niben musikk" desktop app): the listening corner in 3D or flat, a player bar, no other pages.
// Remembered for the tab/window, so reloading stays in the player.
export type Shell = 'site' | 'player'
const KEY = 'niben-shell'
function initial(): Shell {
  try { if (sessionStorage.getItem(KEY) === 'player') return 'player' } catch { /* private mode */ }
  return window.nibenApp?.kind === 'music' ? 'player' : 'site'
}
export const shell = ref<Shell>(initial())

function apply(s: Shell): void {
  document.documentElement.classList.toggle('player-shell', s === 'player')
  try { if (s === 'player') sessionStorage.setItem(KEY, 'player'); else sessionStorage.removeItem(KEY) } catch { /* private mode */ }
}
apply(shell.value)
watch(shell, apply)

export const enterPlayer = (): void => { shell.value = 'player' }
export const leavePlayer = (): void => { shell.value = 'site' }
