import { ref, watch } from 'vue'
import { shell } from './useShell'

// "rom" = the 3D room, "enkel" = plain pages without the room.
const KEY = 'niben-mode'
function stored() {
  try { return localStorage.getItem(KEY) } catch { return null }
}
// phones / small screens start in the plain version (the 3D room is cramped and heavy there);
// an explicit choice is always remembered
function initial() {
  const saved = stored()
  if (saved === 'enkel' || saved === 'rom') return saved
  const small = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return small || reduce ? 'enkel' : 'rom'
}
export const mode = ref(initial())

// the music player app has no 3D room: it is always the plain version
function apply() {
  document.documentElement.classList.toggle('classic', mode.value === 'enkel' || shell.value === 'player')
}
apply()
watch([mode, shell], apply)

export function toggleMode() {
  mode.value = mode.value === 'rom' ? 'enkel' : 'rom'
  try { localStorage.setItem(KEY, mode.value) } catch {}
}
