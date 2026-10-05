import { ref, computed, watch } from 'vue'
import { live, liveDay, watchLive } from './useLive'

// light / dark: 'live' follows day and night where I live (when a place is set in Admin), 'light' and 'dark' are
// fixed. The choice is remembered. Without a place, 'live' isn't offered and it follows the device as before.
export type ThemeChoice = 'auto' | 'live' | 'light' | 'dark'
const KEY = 'niben-theme-mode'
const OLD = 'niben-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const read = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const isChoice = (v: string | null): v is ThemeChoice => v === 'auto' || v === 'live' || v === 'light' || v === 'dark'

const old = read(OLD)
const first = read(KEY)
const mode = ref<ThemeChoice>(isChoice(first) ? first : old === 'dark' || old === 'light' ? old : 'auto')
const system = ref<'light' | 'dark'>(media.matches ? 'dark' : 'light')
media.addEventListener('change', (e) => { system.value = e.matches ? 'dark' : 'light' })

// what is shown: a fixed choice, else (not chosen yet, or 'live') day / night at home, else the device's setting
const theme = computed<'light' | 'dark'>(() => {
  if (mode.value === 'light' || mode.value === 'dark') return mode.value
  if (live.configured && (mode.value === 'live' || mode.value === 'auto')) return liveDay.value ? 'light' : 'dark'
  return system.value
})
watch(theme, (t) => { document.documentElement.dataset.theme = t }, { immediate: true })
watchLive()

function setThemeMode(m: ThemeChoice): void {
  mode.value = m
  try { localStorage.setItem(KEY, m) } catch { /* private mode */ }
}
const themeMode = computed<ThemeChoice>(() => (mode.value === 'auto' ? (live.configured ? 'live' : theme.value) : mode.value))

export function useTheme() {
  function toggle(): void { setThemeMode(theme.value === 'dark' ? 'light' : 'dark') }
  return { theme, toggle, mode: themeMode, setMode: setThemeMode, live }
}
