<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Gauge } from 'lucide-vue-next'
import { mode, toggleMode } from '@/composables/ui/useMode'
import { room } from '@/composables/room/useRoom'

// If the 3D room keeps running slowly, offer the plain version – once per visit, never on its own.
const KEY = 'niben-slow-asked'
const show = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
let slow = 0, since = 0
const asked = () => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
const remember = () => { try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ } }
function dismiss() { show.value = false; remember() }
function accept() { dismiss(); if (mode.value === 'rom') toggleMode() }

onMounted(() => {
  if (asked() || navigator.webdriver || window.matchMedia('(max-width: 820px), (pointer: coarse)').matches) return
  since = Date.now()
  timer = setInterval(() => {
    if (mode.value !== 'rom' || !room.api || Date.now() - since < 12000) { slow = 0; return }
    const fps = room.api.gfxInfo.fps // measured on frames that were actually drawn
    slow = fps > 0 && fps < 12 ? slow + 1 : 0
    if (slow >= 8) { show.value = true; clearInterval(timer) }
  }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="slow glass" role="dialog" aria-label="Bytt til 2D?">
      <Gauge :size="20" aria-hidden="true" />
      <div class="txt"><b>Rommet går tregt</b><span>Vil du bytte til 2D-versjonen? Du kan bytte tilbake med V.</span></div>
      <button class="yes" @click="accept">Bytt til 2D</button>
      <button class="no" @click="dismiss">Nei takk</button>
    </div>
  </transition>
</template>

<style scoped>
.slow { position: fixed; z-index: 85; left: 50%; bottom: 20px; translate: -50% 0; display: flex; align-items: center; gap: 12px; width: min(560px, calc(100vw - 24px)); padding: 12px 14px; border-radius: 18px; background: var(--bg); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28); color: var(--text); }
.slow svg { flex: none; color: var(--accent); }
.txt { flex: 1; min-width: 0; display: grid; line-height: 1.25; }
.txt b { font-size: 1rem; }
.txt span { font-size: 0.78rem; color: var(--text-3); }
button { flex: none; padding: 8px 14px; border: 0; border-radius: 999px; font: 700 0.84rem var(--font); cursor: pointer; }
.yes { background: var(--accent); color: #fff; }
.no { background: transparent; color: var(--text-2); }
.no:hover { color: var(--text); }
</style>
