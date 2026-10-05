import { ref, watch } from 'vue'

// "Rolig modus": no animation, glow or movement anywhere (also off in the 3D room: no weather, no drifting dust …).
// Starts on by itself when the device asks for reduced motion.
const KEY = 'niben-calm'
const read = () => { try { const v = localStorage.getItem(KEY); return v === null ? null : v === '1' } catch { return null } }
export const calm = ref(read() ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches)
watch(calm, (v) => { document.documentElement.classList.toggle('calm', v) }, { immediate: true })
export function setCalm(v) { calm.value = v; try { localStorage.setItem(KEY, v ? '1' : '0') } catch {} }
