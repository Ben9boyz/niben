<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { room } from '@/composables/room/useRoom'

// Draws a glowing line from the selected country on the 3D globe to the info panel.
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: false })

const d = ref('')
const a = ref<{ x: number; y: number } | null>(null) // start point (country)
const b = ref<{ x: number; y: number } | null>(null) // end point (panel)
const visible = ref(false)
const drawKey = ref(0)
let raf = 0

function frame() {
  raf = requestAnimationFrame(frame)
  const p = props.active ? room.api?.countryScreenPoint() : null
  const panel = document.querySelector('.dock .panel')
  if (!p || !panel) { visible.value = false; return }
  const r = panel.getBoundingClientRect()
  const mobile = window.innerWidth <= 900
  const end = mobile ? { x: r.left + r.width * 0.5, y: r.top } : { x: r.left, y: r.top + 72 }
  const dx = end.x - p.x
  const dy = end.y - p.y
  d.value = mobile
    ? `M ${p.x} ${p.y} C ${p.x} ${p.y + dy * 0.5}, ${end.x} ${end.y - dy * 0.5}, ${end.x} ${end.y}`
    : `M ${p.x} ${p.y} C ${p.x + dx * 0.45} ${p.y}, ${end.x - dx * 0.35} ${end.y}, ${end.x} ${end.y}`
  a.value = p
  b.value = end
  visible.value = true
}

watch(() => room.sel.land, () => drawKey.value++)
onMounted(() => (raf = requestAnimationFrame(frame)))
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <svg class="leader" :class="{ on: visible }" aria-hidden="true">
    <defs>
      <linearGradient id="leaderGrad" gradientUnits="userSpaceOnUse" :x1="a?.x || 0" :y1="a?.y || 0" :x2="b?.x || 0" :y2="b?.y || 0">
        <stop offset="0" stop-color="#ffb347" />
        <stop offset="1" stop-color="var(--accent)" />
      </linearGradient>
    </defs>
    <g :key="drawKey">
      <path class="glow" :d="d" pathLength="1" />
      <path class="line" :d="d" pathLength="1" />
      <template v-if="a">
        <circle class="pulse" :cx="a.x" :cy="a.y" r="6" />
        <circle class="dot" :cx="a.x" :cy="a.y" r="4.5" />
      </template>
      <circle v-if="b" class="end" :cx="b.x" :cy="b.y" r="3.5" />
    </g>
  </svg>
</template>

<style scoped>
.leader {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 15;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.35s var(--ease);
}
.leader.on { opacity: 1; }
.line, .glow {
  fill: none;
  stroke: url(#leaderGrad);
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 0.9s var(--ease) 0.6s forwards;
}
.line { stroke-width: 2; }
.glow { stroke-width: 7; opacity: 0.25; filter: blur(3px); }
@keyframes draw { to { stroke-dashoffset: 0; } }
.dot { fill: #ffb347; stroke: #fff; stroke-width: 1.5; }
.pulse { fill: none; stroke: #ffb347; stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: pulse 1.8s ease-out infinite; }
@keyframes pulse { from { transform: scale(1); opacity: 0.9; } to { transform: scale(3.2); opacity: 0; } }
.end { fill: var(--accent); opacity: 0; animation: endIn 0.3s ease 1.4s forwards; }
@keyframes endIn { to { opacity: 1; } }
</style>
