import { computed, watch } from 'vue'
import { siteTexts } from '@/composables/site/useTexts'
import { useTheme } from './useTheme'

// The site's accent colour (the blue). The standard is the blue the site has always had (style.css); a room's owner can pick
// another one under Admin → Profil. It is kept with the room's texts (key theme.accent), so every visitor of that room sees it.
// Nothing is set while the standard is chosen: the stylesheet's own values are used, so the default looks exactly as before.
export const ACCENT_KEY = 'theme.accent'
export const DEFAULT_ACCENT = '#2b8cff'
export const ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: 'blue', label: 'Blå (standard)', hex: DEFAULT_ACCENT },
  { id: 'red', label: 'Rød', hex: '#e5484d' },
  { id: 'orange', label: 'Oransje', hex: '#f08a24' },
  { id: 'green', label: 'Grønn', hex: '#2fb36d' },
  { id: 'purple', label: 'Lilla', hex: '#8b5cf6' },
  { id: 'pink', label: 'Rosa', hex: '#e5559b' },
]

const HEX = /^#[0-9a-f]{6}$/i
/** A valid #rrggbb, or null (also for the standard blue: nothing to override). */
export function validAccent(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().toLowerCase()
  return HEX.test(s) && s !== DEFAULT_ACCENT ? s : null
}

type RGB = [number, number, number]
const toRgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
const mix = (a: RGB, b: RGB, k: number): RGB => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * k)) as RGB
const css = (c: RGB): string => `rgb(${c[0]} ${c[1]} ${c[2]})`
const rgba = (c: RGB, a: number): string => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`
const WHITE: RGB = [255, 255, 255]

/** The four values the stylesheet has (accent, a lighter one, a soft background, a glow) worked out from one colour. */
export function deriveAccent(hex: string, dark: boolean): { accent: string; accent2: string; soft: string; glow: string } {
  const base = toRgb(hex)
  const main = dark ? mix(base, WHITE, 0.28) : base // (a lighter blue / red / … on the dark background)
  const second = mix(main, WHITE, dark ? 0.32 : 0.42)
  return { accent: css(main), accent2: css(second), soft: rgba(main, dark ? 0.14 : 0.12), glow: rgba(dark ? main : second, dark ? 0.45 : 0.55) }
}

const VARS = ['--accent', '--accent-2', '--accent-soft', '--accent-glow', '--logo-knob', '--logo-star'] as const
export const accentHex = computed(() => validAccent(siteTexts[ACCENT_KEY]))

/** Keeps the page's colours in step with the room's accent and the light / dark theme. Call once. */
export function useAccent(): void {
  const { theme } = useTheme()
  watch([accentHex, theme], ([hex, t]) => {
    const st = document.documentElement.style
    if (!hex) { for (const v of VARS) st.removeProperty(v); return }
    const d = deriveAccent(hex, t === 'dark')
    st.setProperty('--accent', d.accent)
    st.setProperty('--accent-2', d.accent2)
    st.setProperty('--accent-soft', d.soft)
    st.setProperty('--accent-glow', d.glow)
    st.setProperty('--logo-knob', d.accent)
    st.setProperty('--logo-star', d.accent)
  }, { immediate: true })
}
