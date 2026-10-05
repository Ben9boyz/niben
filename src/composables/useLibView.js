import { reactive } from 'vue'

// Phones: the library as a grid of covers or as a list (cover + name + artist on one line – easier to read on a small screen,
// and the names are always there, because there is no hover on a phone). Remembered per browser.
const KEY = 'niben-lib-list'
export const libView = reactive({ list: (() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })() })
export function setLibList(v) {
  libView.list = !!v
  try { localStorage.setItem(KEY, v ? '1' : '0') } catch {}
}
