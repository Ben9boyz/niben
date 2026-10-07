<script setup lang="ts">
import { computed } from 'vue'
import { rooms } from '@/composables/room/useRooms'

// On the way into another room: while its things are fetched, a door in the middle of the screen swings to and fro with light
// behind it, and says whose room you are going into. It only shows when the wait is long enough to notice (a quarter of a second).
const name = computed(() => rooms.entering)
</script>

<template>
  <Transition name="re">
    <div v-if="rooms.entering" class="re" role="status" aria-live="polite">
      <div class="card glass">
        <span class="door" aria-hidden="true"><span class="light"></span><span class="leaf"><i></i></span></span>
        <span class="txt">Går inn i rommet til <b>{{ name }}</b><span class="dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.re { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; pointer-events: none; animation: reIn 0.3s 0.25s both; }
@keyframes reIn { from { opacity: 0; } }
.card { display: flex; align-items: center; gap: 14px; padding: 14px 22px 14px 16px; border-radius: 22px; color: var(--text); font-size: 0.95rem; }
.door { position: relative; width: 26px; height: 38px; border: 2.5px solid var(--accent); border-bottom-width: 0; border-radius: 12px 12px 3px 3px; perspective: 140px; flex: none; }
.light { position: absolute; inset: 0; border-radius: 9px 9px 0 0; background: radial-gradient(circle at 50% 75%, #ffd27a, color-mix(in srgb, var(--accent) 30%, transparent)); animation: glow 1.4s ease-in-out infinite; }
.leaf { position: absolute; inset: 0; border-radius: 9px 9px 0 0; background: var(--bg); border-right: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); transform-origin: 0 50%; animation: swing 1.4s cubic-bezier(0.5, 0, 0.3, 1) infinite; }
.leaf i { position: absolute; right: 4px; top: 55%; width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }
@keyframes swing { 0%, 100% { transform: rotateY(0); } 50% { transform: rotateY(-75deg); } }
@keyframes glow { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
.txt b { font-weight: 800; }
.dots i { font-style: normal; animation: dot 1.2s infinite; } .dots i:nth-child(2) { animation-delay: 0.2s; } .dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot { 0%, 60%, 100% { opacity: 0.2; } 30% { opacity: 1; } }
.re-leave-active { transition: opacity 0.35s; } .re-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .leaf, .light, .dots i { animation: none; } }
</style>
