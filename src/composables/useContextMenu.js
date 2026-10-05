import { reactive } from 'vue'

// Right-click (or a long press on a phone) on an album, playlist or song opens a small menu with what Spotify
// offers there: play, queue, open, artist, add to a playlist, copy the link …
export const ctx = reactive({ open: false, x: 0, y: 0, title: '', items: [] })

/** items: [{ label, icon?, run?, danger?, sub?: [{label, run}] }] or { sep: true } */
export function showMenu(e, title, items) {
  const list = items.filter(Boolean)
  if (!list.length) return
  e.preventDefault?.()
  const pt = e.touches?.[0] || e.changedTouches?.[0] || e
  ctx.title = title || ''
  ctx.items = list
  ctx.x = pt.clientX ?? 0
  ctx.y = pt.clientY ?? 0
  ctx.open = true
}
export const closeMenu = () => { ctx.open = false }

/** Long-press for touch screens (iOS has no right click): returns handlers to spread on the element. */
export function longPress(fn, ms = 520) {
  let t = 0, sx = 0, sy = 0, fired = false
  const clear = () => { clearTimeout(t); t = 0 }
  return {
    touchstart(e) { fired = false; const p = e.touches[0]; sx = p.clientX; sy = p.clientY; clear(); t = setTimeout(() => { fired = true; fn({ clientX: sx, clientY: sy, preventDefault() {} }) }, ms) },
    touchmove(e) { const p = e.touches[0]; if (Math.hypot(p.clientX - sx, p.clientY - sy) > 10) clear() },
    touchend(e) { clear(); if (fired) { e.preventDefault(); fired = false } },
    touchcancel: clear,
  }
}
