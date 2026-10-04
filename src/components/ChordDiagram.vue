<script setup>
import { computed } from 'vue'
import { findChord } from '../lib/chords'

// A chord box: six strings, the frets, dots with finger numbers, barres, x / o above the nut.
const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 120 }, // width in px
  showName: { type: Boolean, default: true },
})

const chord = computed(() => findChord(props.name))
const W = 100, H = 118, LEFT = 14, RIGHT = 86, TOP = 26, ROWS = 4, ROW_H = 19
const sx = (i) => LEFT + (i * (RIGHT - LEFT)) / 5

const view = computed(() => {
  const c = chord.value
  if (!c) return null
  const fretted = c.frets.filter((f) => f > 0)
  const max = Math.max(0, ...fretted)
  const base = max > ROWS ? Math.min(...fretted) : 1 // first fret shown
  const dots = []
  const barres = []
  const byFinger = {}
  c.frets.forEach((f, i) => {
    if (!(f > 0)) return
    const finger = c.fingers[i] || 0
    const key = `${finger}:${f}`
    if (finger) (byFinger[key] ||= []).push(i)
    dots.push({ x: sx(i), y: TOP + (f - base + 0.5) * ROW_H, finger, key })
  })
  // a finger on 3+ strings at one fret (or the index on 2+) is a barre
  for (const [key, strings] of Object.entries(byFinger)) {
    const [finger, fret] = key.split(':').map(Number)
    if (strings.length >= (finger === 1 ? 2 : 3)) {
      barres.push({ x1: sx(Math.min(...strings)), x2: sx(Math.max(...strings)), y: TOP + (fret - base + 0.5) * ROW_H, finger, fret })
    }
  }
  const barreKeys = new Set(barres.map((b) => `${b.finger}:${b.fret}`))
  return {
    base,
    open: c.frets.map((f, i) => ({ x: sx(i), mark: f === null ? 'x' : f === 0 ? 'o' : '' })),
    dots: dots.filter((d) => !barreKeys.has(d.key)),
    barres,
  }
})
</script>

<template>
  <figure class="chord" :style="{ width: `${size}px` }">
    <figcaption v-if="showName">{{ name }}</figcaption>
    <svg v-if="view" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`Akkord ${name}`">
      <!-- nut (thick) or the fret number -->
      <rect v-if="view.base === 1" :x="LEFT - 1" :y="TOP - 4" :width="RIGHT - LEFT + 2" height="4" rx="1" class="nut" />
      <text v-else :x="RIGHT + 4" :y="TOP + ROW_H * 0.65" class="fr">{{ view.base }}fr</text>
      <line v-for="r in ROWS + 1" :key="`f${r}`" :x1="LEFT" :x2="RIGHT" :y1="TOP + (r - 1) * ROW_H" :y2="TOP + (r - 1) * ROW_H" class="fret" />
      <line v-for="s in 6" :key="`s${s}`" :x1="sx(s - 1)" :x2="sx(s - 1)" :y1="TOP" :y2="TOP + ROWS * ROW_H" class="string" />
      <text v-for="(o, i) in view.open" :key="`o${i}`" :x="o.x" :y="TOP - 9" class="mark">{{ o.mark }}</text>
      <g v-for="(b, i) in view.barres" :key="`b${i}`">
        <rect :x="b.x1 - 6" :y="b.y - 6" :width="b.x2 - b.x1 + 12" height="12" rx="6" class="dot" />
        <text :x="b.x1" :y="b.y + 3.6" class="fn">{{ b.finger }}</text>
      </g>
      <g v-for="(d, i) in view.dots" :key="`d${i}`">
        <circle :cx="d.x" :cy="d.y" r="6.2" class="dot" />
        <text v-if="d.finger" :x="d.x" :y="d.y + 3.6" class="fn">{{ d.finger }}</text>
      </g>
    </svg>
    <div v-else class="unknown">?</div>
  </figure>
</template>

<style scoped>
.chord { margin: 0; display: grid; justify-items: center; gap: 2px; }
figcaption { font-weight: 800; font-size: 1.05em; letter-spacing: -0.01em; }
svg { width: 100%; height: auto; overflow: visible; }
.nut { fill: var(--text); }
.fret { stroke: var(--text-3); stroke-width: 1; }
.string { stroke: var(--text-2); stroke-width: 1.1; }
.mark { font: 600 9px var(--font); fill: var(--text-2); text-anchor: middle; }
.fr { font: 600 8px var(--font); fill: var(--text-3); }
.dot { fill: var(--accent); }
.fn { font: 700 8px var(--font); fill: #fff; text-anchor: middle; }
.unknown { width: 100%; aspect-ratio: 100 / 118; display: grid; place-items: center; border: 2px dashed var(--glass-border); border-radius: 10px; color: var(--text-3); font-size: 1.6rem; }
</style>
