<script setup lang="ts">
import { ref, computed } from 'vue'
import { jpHistory, loadJapaneseHistory, type JpSnapshot } from '../composables/useJapanese'

// Vocabulary over time: "Kan" (area + line) and "Lærer" (thin line) from the daily jpdb snapshots.
loadJapaneseHistory()

const RANGES = [{ k: 30, l: '30 d' }, { k: 90, l: '90 d' }, { k: 365, l: '1 år' }, { k: 0, l: 'Alt' }]
const range = ref(90)
const table = ref(false)
const hover = ref<number | null>(null)

const pts = computed(() => {
  const all = jpHistory.points.filter((p) => p && p.d)
  if (!range.value) return all
  return all.slice(-range.value)
})
const W = 460, H = 190, PL = 32, PR = 78, PT = 12, PB = 22
const ymax = computed(() => {
  const m = Math.max(1, ...pts.value.map((p) => Math.max(p.known || 0, p.learning || 0)))
  const step = m > 800 ? 200 : m > 300 ? 100 : m > 100 ? 50 : 10
  return Math.ceil(m / step) * step
})
const x = (i: number) => PL + (pts.value.length < 2 ? 0 : (i / (pts.value.length - 1)) * (W - PL - PR))
const y = (v: number) => PT + (1 - v / ymax.value) * (H - PT - PB)
const line = (key: 'known' | 'learning') => pts.value.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key] || 0).toFixed(1)}`).join(' ')
const area = computed(() => `${line('known')} L${x(pts.value.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`)
const ticks = computed(() => [0, 0.5, 1].map((f) => Math.round(ymax.value * f)))
const last = computed<JpSnapshot>(() => pts.value[pts.value.length - 1] ?? { d: '', known: 0, learning: 0, new: 0, due: 0 })
const delta = computed(() => (pts.value.length > 1 ? (last.value.known || 0) - (pts.value[0]?.known || 0) : 0))
const fmt = (d: string) => new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
const xLabels = computed(() => {
  const n = pts.value.length
  return n < 2 ? [] : [0, Math.floor((n - 1) / 2), n - 1].map((i) => ({ i, t: fmt(pts.value[i]?.d ?? '') }))
})

function move(e: MouseEvent | PointerEvent) {
  const r = (e.currentTarget as SVGElement).getBoundingClientRect()
  const px = ((e.clientX - r.left) / r.width) * W
  const n = pts.value.length
  hover.value = Math.max(0, Math.min(n - 1, Math.round(((px - PL) / (W - PL - PR)) * (n - 1))))
}
const hp = computed(() => (hover.value == null ? null : pts.value[hover.value]))
</script>

<template>
  <section class="vc">
    <header>
      <div>
        <h3>Ordforråd over tid</h3>
        <p v-if="pts.length > 1" class="head"><b>{{ delta >= 0 ? '+' : '' }}{{ delta }}</b> ord kjent siste {{ pts.length }} dager</p>
      </div>
      <div class="ctl">
        <button v-for="r in RANGES" :key="r.k" class="pbtn" :class="{ on: range === r.k }" @click="range = r.k">{{ r.l }}</button>
        <button class="pbtn" :class="{ on: table }" @click="table = !table">Tabell</button>
      </div>
    </header>

    <p v-if="jpHistory.loaded && pts.length < 2" class="empty">Vi lagrer ett punkt per dag. Kom tilbake i morgen, så begynner kurven å tegne seg.</p>

    <template v-else-if="pts.length > 1">
      <ul class="legend">
        <li><i class="sw known"></i>Kan</li>
        <li><i class="sw learning"></i>Lærer</li>
      </ul>

      <div v-if="!table" class="plot">
      <svg :viewBox="`0 0 ${W} ${H}`" class="svg" role="img" :aria-label="`Ordforråd: ${last.known} kjent, ${last.learning} lærer`" @pointermove="move" @pointerleave="hover = null">
        <g class="grid">
          <template v-for="t in ticks" :key="t">
            <line :x1="PL" :x2="W - PR" :y1="y(t)" :y2="y(t)" />
            <text :x="PL - 6" :y="y(t) + 3" text-anchor="end">{{ t }}</text>
          </template>
        </g>
        <path :d="area" class="area" />
        <path :d="line('known')" class="l known" />
        <path :d="line('learning')" class="l learning" />
        <text v-for="l in xLabels" :key="l.i" :x="x(l.i)" :y="H - 4" :text-anchor="l.i === 0 ? 'start' : l.i === pts.length - 1 ? 'end' : 'middle'" class="xl">{{ l.t }}</text>
        <text :x="W - PR + 6" :y="y(last.known || 0) + 3" class="end">Kan {{ last.known }}</text>
        <text :x="W - PR + 6" :y="y(last.learning || 0) + (Math.abs(y(last.known || 0) - y(last.learning || 0)) < 12 ? 15 : 3)" class="end">Lærer {{ last.learning }}</text>
        <template v-if="hp">
          <line :x1="x(hover ?? 0)" :x2="x(hover ?? 0)" :y1="PT" :y2="H - PB" class="cross" />
          <circle :cx="x(hover ?? 0)" :cy="y(hp.known || 0)" r="4" class="dot known" />
          <circle :cx="x(hover ?? 0)" :cy="y(hp.learning || 0)" r="4" class="dot learning" />
        </template>
        <rect :x="PL" :y="0" :width="W - PL - PR" :height="H" fill="transparent" />
      </svg>
      <div v-if="hp" class="tip" :style="{ left: `${(x(hover ?? 0) / W) * 100}%` }">
        <b>{{ fmt(hp.d) }}</b>
        <span><i class="sw known"></i>Kan {{ hp.known }}</span>
        <span><i class="sw learning"></i>Lærer {{ hp.learning }}</span>
      </div>
      </div>

      <div v-if="table" class="tbl">
        <table>
          <thead><tr><th>Dato</th><th>Kan</th><th>Lærer</th></tr></thead>
          <tbody><tr v-for="p in [...pts].reverse().slice(0, 60)" :key="p.d"><td>{{ p.d }}</td><td>{{ p.known }}</td><td>{{ p.learning }}</td></tr></tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.vc {
  --c-known: #2b8cff; --c-learning: #d97e0a;
  position: relative; display: grid; gap: 8px; padding: 14px; border-radius: 16px;
  border: 1px solid var(--glass-border); background: var(--glass-strong);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) .vc { --c-known: #3a8de0; --c-learning: #c97a18; } }
:root[data-theme='dark'] .vc { --c-known: #3a8de0; --c-learning: #c97a18; }
header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 8px; }
h3 { margin: 0; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.head { margin: 2px 0 0; color: var(--text-2); font-size: 0.85rem; }
.head b { font-size: 1.3rem; color: var(--text); margin-right: 4px; }
.ctl { display: flex; flex-wrap: wrap; gap: 4px; }
.empty { margin: 0; color: var(--text-3); font-size: 0.85rem; }
.legend { display: flex; gap: 14px; margin: 0; padding: 0; list-style: none; color: var(--text-2); font-size: 0.78rem; }
.legend li, .tip span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
.sw.known { background: var(--c-known); } .sw.learning { background: var(--c-learning); }
.svg { width: 100%; height: auto; touch-action: pan-y; display: block; }
.grid line { stroke: var(--glass-border); stroke-width: 1; }
.grid text, .xl { fill: var(--text-3); font-size: 10px; }
.area { fill: var(--c-known); opacity: 0.14; }
.l { fill: none; stroke-linejoin: round; stroke-linecap: round; }
.l.known { stroke: var(--c-known); stroke-width: 2; }
.l.learning { stroke: var(--c-learning); stroke-width: 1.5; }
.end { fill: var(--text-2); font-size: 11px; font-weight: 600; }
.cross { stroke: var(--text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.dot { stroke: var(--glass-strong); stroke-width: 2; }
.dot.known { fill: var(--c-known); } .dot.learning { fill: var(--c-learning); }
.plot { position: relative; }
.tip { position: absolute; top: 0; transform: translateX(-50%); display: grid; gap: 2px; padding: 6px 10px; border-radius: 10px; background: var(--glass-strong); border: 1px solid var(--glass-border); color: var(--text); font-size: 0.78rem; pointer-events: none; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18); white-space: nowrap; }
.tbl { max-height: 220px; overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.82rem; color: var(--text-2); }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--glass-border); }
th { color: var(--text-3); font-weight: 600; }
</style>
