import * as THREE from 'three'

// The room's accent colour for the things in the 3D room that glow or mark something (the timer's hand, the LED, the screen
// glow, visited countries, the selection box). Furniture that just happens to be blue stays as it is. The standard is the
// blue the room has always had; `setAccent3d` is called with the owner's colour (or null for the standard).
const STANDARD = 0x2b8cff
const STANDARD_LIGHT = 0x5cb6ff
export const accent = new THREE.Color(STANDARD)
export const accentLight = new THREE.Color(STANDARD_LIGHT)
const subs: (() => void)[] = []
/** Run `fn` now and every time the accent changes. */
export function onAccent(fn: () => void): void { subs.push(fn); fn() }
export function setAccent3d(hex: string | null): void {
  accent.set(hex ?? STANDARD)
  if (hex) accentLight.set(hex).lerp(new THREE.Color(0xffffff), 0.3); else accentLight.set(STANDARD_LIGHT)
  for (const f of subs) f()
}
