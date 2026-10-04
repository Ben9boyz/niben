import { ref, watch } from 'vue'

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

function apply(m) {
  document.documentElement.classList.toggle('classic', m === 'enkel')
}
apply(mode.value)
watch(mode, (m) => apply(m))

export function toggleMode() {
  mode.value = mode.value === 'rom' ? 'enkel' : 'rom'
  try { localStorage.setItem(KEY, mode.value) } catch {}
}
