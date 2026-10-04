import { ref, watch } from 'vue'

const KEY = 'niben-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function stored() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

const theme = ref(stored() || (media.matches ? 'dark' : 'light'))

function apply(t) {
  document.documentElement.dataset.theme = t
}
apply(theme.value)

media.addEventListener('change', (e) => {
  if (!stored()) theme.value = e.matches ? 'dark' : 'light'
})

watch(theme, (t) => apply(t))

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(KEY, theme.value) } catch {}
  }
  return { theme, toggle }
}
