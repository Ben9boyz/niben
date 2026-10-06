import { reactive, type Component } from 'vue'

// Right-click (or a long press on a phone) on an album, playlist or song opens a small menu with what Spotify
// offers there: play, queue, open, artist, add to a playlist, copy the link …
export interface MenuEntry {
  label?: string
  icon?: Component
  img?: string | null
  run?: () => void | Promise<unknown>
  danger?: boolean
  sub?: MenuEntry[]
  sep?: boolean
}
export const ctx = reactive({ open: false, x: 0, y: 0, title: '', items: [] as MenuEntry[] })

/** Where a menu is opened from: a mouse / pointer event, or a long press (see below). */
export interface MenuPoint { clientX?: number; clientY?: number; preventDefault?: () => void; touches?: TouchList; changedTouches?: TouchList }

/** items: entries, or { sep: true } for a divider; empty / false entries are skipped. */
export function showMenu(e: MenuPoint, title: string | undefined, items: (MenuEntry | false | null | undefined)[]): void {
  const list = items.filter((x): x is MenuEntry => !!x)
  if (!list.length) return
  e.preventDefault?.()
  const pt = e.touches?.[0] ?? e.changedTouches?.[0] ?? e
  ctx.title = title || ''
  ctx.items = list
  ctx.x = pt.clientX ?? 0
  ctx.y = pt.clientY ?? 0
  ctx.open = true
}
export const closeMenu = (): void => { ctx.open = false }

/** Long-press for touch screens (iOS has no right click): returns handlers to spread on the element. */
export function longPress(fn: (p: MenuPoint) => void, ms = 520) {
  let t = 0, sx = 0, sy = 0, fired = false
  const clear = (): void => { clearTimeout(t); t = 0 }
  return {
    touchstart(e: TouchEvent): void {
      fired = false
      const p = e.touches[0]
      if (!p) return
      sx = p.clientX; sy = p.clientY
      clear()
      t = window.setTimeout(() => { fired = true; fn({ clientX: sx, clientY: sy, preventDefault() {} }) }, ms)
    },
    touchmove(e: TouchEvent): void { const p = e.touches[0]; if (p && Math.hypot(p.clientX - sx, p.clientY - sy) > 10) clear() },
    touchend(e: TouchEvent): void { clear(); if (fired) { e.preventDefault(); fired = false } },
    touchcancel: clear,
  }
}
