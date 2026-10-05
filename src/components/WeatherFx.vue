<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { weather } from '../composables/useLive'
import { calm } from '../composables/useCalm'

// The weather at home over the plain version: rain, snow or fog drifting over the background (never over the text –
// it is behind the content, in front of the backdrop). Off with "reduce motion". One small canvas, ~30 frames a second.
const cv = ref(null)
let raf = 0, last = 0, drops = [], w = 0, h = 0, ctx = null, kind = 'clear'
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function size() {
  if (!cv.value) return
  w = cv.value.width = Math.ceil(innerWidth / 2)
  h = cv.value.height = Math.ceil(innerHeight / 2)
}
function make() {
  const n = kind === 'drizzle' ? 70 : kind === 'rain' ? 150 : kind === 'thunder' ? 210 : kind === 'snow' ? 90 : 0
  drops = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, v: 0.6 + Math.random() * 0.8, l: 6 + Math.random() * 8, s: 1 + Math.random() * 2 }))
}
function frame(t) {
  raf = requestAnimationFrame(frame)
  if (t - last < 33 || document.hidden) return
  const dt = Math.min(2, (t - last) / 16); last = t
  ctx.clearRect(0, 0, w, h)
  const dark = document.documentElement.dataset.theme === 'dark'
  if (kind === 'snow') {
    ctx.fillStyle = dark ? 'rgba(235,242,255,0.8)' : 'rgba(255,255,255,0.95)'
    ctx.shadowColor = 'rgba(120,140,180,0.5)'; ctx.shadowBlur = dark ? 0 : 3
    for (const d of drops) { d.y += d.v * 1.1 * dt; d.x += Math.sin((d.y + d.s * 40) / 22) * 0.4; if (d.y > h) { d.y = -4; d.x = Math.random() * w } ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, 6.3); ctx.fill() }
    ctx.shadowBlur = 0
  } else if (drops.length) {
    ctx.strokeStyle = dark ? 'rgba(170,200,255,0.5)' : 'rgba(70,110,170,0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const d of drops) { d.y += d.v * 14 * dt; d.x -= d.v * 2.4 * dt; if (d.y > h) { d.y = -d.l; d.x = Math.random() * (w + 40) } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 2, d.y + d.l) }
    ctx.stroke()
    if (kind === 'thunder' && Math.random() < 0.004) flash()
  }
}
const flashing = ref(0)
function flash() { flashing.value = 1; setTimeout(() => (flashing.value = 0.5), 80); setTimeout(() => (flashing.value = 0), 220) }
function start() {
  cancelAnimationFrame(raf)
  kind = weather.value?.kind || 'clear'
  if (reduce || calm.value || !['drizzle', 'rain', 'thunder', 'snow'].includes(kind)) { ctx?.clearRect(0, 0, w, h); return }
  size(); make()
  raf = requestAnimationFrame(frame)
}
onMounted(() => { ctx = cv.value.getContext('2d'); window.addEventListener('resize', start); start() })
onBeforeUnmount(() => { cancelAnimationFrame(raf); window.removeEventListener('resize', start) })
watch(() => [weather.value?.kind, calm.value], start)
</script>

<template>
  <div class="wfx" :class="[weather?.kind, { fog: weather?.kind === 'fog', gloom: ['rain', 'drizzle', 'thunder', 'cloud'].includes(weather?.kind) }]" aria-hidden="true">
    <canvas ref="cv"></canvas>
    <i class="flash" :style="{ opacity: flashing }"></i>
  </div>
</template>

<style scoped>
.wfx { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
/* grey weather: the backdrop dims a little */
.wfx.gloom::before { content: ''; position: absolute; inset: 0; background: rgba(90, 105, 130, 0.12); }
:root[data-theme="dark"] .wfx.gloom::before { background: rgba(0, 0, 0, 0.18); }
.wfx.fog::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(235, 240, 248, 0.55), rgba(235, 240, 248, 0.2) 60%, rgba(235, 240, 248, 0.45)); }
:root[data-theme="dark"] .wfx.fog::before { background: linear-gradient(180deg, rgba(120, 135, 160, 0.3), rgba(120, 135, 160, 0.1) 60%, rgba(120, 135, 160, 0.25)); }
.flash { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.55); transition: opacity 0.08s; opacity: 0; }
</style>
