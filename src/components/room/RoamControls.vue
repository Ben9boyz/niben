<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Footprints, X } from 'lucide-vue-next'
import { room } from '@/composables/room/useRoom'
import { mode } from '@/composables/ui/useMode'

// Free roam: a button that lets you walk around in the room (WASD / arrows + drag to look; a joystick on a phone).
// Leaving (Esc, the X, or going to another page) takes the camera back to the station it was at.
const route = useRoute()
const canRoam = computed(() => mode.value === 'rom' && room.ready && route.name !== 'admin')
const touch = window.matchMedia('(pointer: coarse)').matches
const toggle = () => { room.roam = !room.roam }
const onKey = (e: KeyboardEvent) => { if (room.roam && e.key === 'Escape') { room.roam = false; e.preventDefault() } }
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); room.roam = false })
watch(() => route.fullPath, () => { room.roam = false })
watch(canRoam, (v) => { if (!v) room.roam = false })

// the joystick (phones)
const stick = ref<HTMLElement | null>(null)
const knob = ref({ x: 0, y: 0 })
let id = -1
function move(e: PointerEvent) {
  if (e.pointerId !== id || !stick.value) return
  const r = stick.value.getBoundingClientRect()
  const R = r.width / 2
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R)
  const len = Math.hypot(dx, dy)
  if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R }
  knob.value = { x: dx, y: dy }
  room.api?.roamMove(dx / R, dy / R)
}
function down(e: PointerEvent) { id = e.pointerId; stick.value?.setPointerCapture(e.pointerId); move(e) }
function up(e: PointerEvent) { if (e.pointerId !== id) return; id = -1; knob.value = { x: 0, y: 0 }; room.api?.roamMove(0, 0) }
</script>

<template>
  <button v-if="canRoam && !room.roam" class="roam-btn glass" title="Gå rundt i rommet" aria-label="Gå rundt i rommet" @click="toggle"><Footprints :size="19" aria-hidden="true" /></button>
  <template v-if="room.roam">
    <div class="roam-hint glass" role="status">
      <span v-if="!touch"><b>W A S D</b> eller piltaster for å gå · <b>Shift</b> for å skynde deg · dra med musa for å se deg rundt</span>
      <span v-else>Dra på skjermen for å se deg rundt · styrepinnen går</span>
    </div>
    <button class="roam-exit glass" aria-label="Slutt å gå rundt (Esc)" title="Slutt å gå rundt (Esc)" @click="toggle"><X :size="18" aria-hidden="true" />Ut</button>
    <div v-if="touch" ref="stick" class="stick glass" @pointerdown.prevent="down" @pointermove="move" @pointerup="up" @pointercancel="up">
      <i class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }"></i>
    </div>
  </template>
</template>

<style scoped>
.roam-btn { position: fixed; z-index: 30; left: 76px; bottom: 16px; width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; }
.roam-btn:hover { color: var(--accent); }
.roam-hint { position: fixed; z-index: 40; left: 50%; bottom: 18px; transform: translateX(-50%); max-width: calc(100vw - 32px); padding: 9px 16px; border-radius: 999px; font-size: 0.82rem; color: var(--text-2); text-align: center; pointer-events: none; }
.roam-hint b { color: var(--text); }
.roam-exit { position: fixed; z-index: 41; top: 18px; right: 18px; display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px 0 12px; border: 0; border-radius: 999px; color: var(--text); font: 700 0.86rem var(--font); cursor: pointer; }
.stick { position: fixed; z-index: 41; left: 22px; bottom: calc(80px + env(safe-area-inset-bottom)); width: 120px; height: 120px; border-radius: 50%; touch-action: none; display: grid; place-items: center; }
.knob { width: 52px; height: 52px; border-radius: 50%; background: var(--accent-soft); box-shadow: 0 0 0 2px var(--accent) inset; }
@media (max-width: 720px) {
  .roam-btn { left: auto; right: 14px; bottom: auto; top: calc(116px + env(safe-area-inset-top)); width: 40px; height: 40px; }
  .roam-hint { bottom: calc(16px + env(safe-area-inset-bottom)); }
}
</style>
