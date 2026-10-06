import { ref, watch, nextTick } from 'vue'
import { shell } from './useShell'

// "rom" = the 3D room, "enkel" = plain pages without the room.
export type Mode = 'rom' | 'enkel'
const KEY = 'niben-mode'
function stored(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}
// phones / small screens start in the plain version (the 3D room is cramped and heavy there);
// an explicit choice is always remembered
function initial(): Mode {
  const saved = stored()
  if (saved === 'enkel' || saved === 'rom') return saved
  const small = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return small || reduce ? 'enkel' : 'rom'
}
export const mode = ref<Mode>(initial())

// the music player app has no 3D room: it is always the plain version
function apply(): void {
  document.documentElement.classList.toggle('classic', mode.value === 'enkel' || shell.value === 'player')
}
apply()
watch([mode, shell], apply)

function flip(): void {
  mode.value = mode.value === 'rom' ? 'enkel' : 'rom'
  try { localStorage.setItem(KEY, mode.value) } catch { /* private mode */ }
}

/** Switch between the 3D room and the plain version. The page "walks" in or out of the room: the old view
 *  zooms away while the new one settles in (the browser's view transition – skipped without it, and for
 *  people who want less motion). */
export function toggleMode(): void {
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduce) return flip()
  const html = document.documentElement
  html.dataset.vt = mode.value === 'rom' ? 'out' : 'in' // out of the room / into the room
  const t = doc.startViewTransition(async () => { flip(); await nextTick() }) as { finished?: Promise<unknown> }
  void t.finished?.finally(() => { delete html.dataset.vt })
}
