<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ChevronLeft, ChevronRight, X, LayoutGrid } from 'lucide-vue-next'
import { thumb } from '../lib/photos'

// Full-screen photos for a trip: a grid of every photo, and a viewer for one photo at a time
// (arrows / swipe / keys, a film strip below). `index` null = the grid.
const props = defineProps({
  title: { type: String, default: '' },
  photos: { type: Array, required: true },
  index: { type: Number, default: null },
})
const emit = defineEmits(['close', 'update:index'])

const i = computed(() => props.index)
const cur = computed(() => (i.value === null ? null : props.photos[i.value]))
const n = computed(() => props.photos.length)
// opened straight on a photo (from the trip card) → back closes; opened via the grid → back to the grid
const cameFromGrid = ref(props.index === null)

function go(k) { emit('update:index', k) }
function step(d) { if (i.value !== null) go((i.value + d + n.value) % n.value) }
function toGrid() { cameFromGrid.value = true; go(null) }
function back() { if (i.value !== null && cameFromGrid.value) go(null); else emit('close') }

// full image: show the 900 px copy at once, swap in the full one when it has loaded
const loaded = ref(new Set())
function preload(k) {
  const p = props.photos[(k + n.value) % n.value]
  if (!p || loaded.value.has(p.src)) return
  const img = new Image()
  img.onload = () => { loaded.value = new Set(loaded.value).add(p.src) }
  img.src = p.src
}
watch(i, (k) => {
  if (k === null) return
  preload(k); preload(k + 1); preload(k - 1)
  nextTick(() => strip.value?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }))
}, { immediate: true })

// swipe (touch / pen / mouse drag)
const dx = ref(0)
let start = null
function onDown(e) { if (e.button === 0 || e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY, t: performance.now() } }
function onMove(e) { if (start) dx.value = e.clientX - start.x }
function onUp(e) {
  if (!start) return
  const d = e.clientX - start.x
  const fast = Math.abs(d) > 30 && performance.now() - start.t < 300
  if (Math.abs(d) > 70 || fast) step(d < 0 ? 1 : -1)
  start = null
  dx.value = 0
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); back() }
  else if (i.value !== null && e.key === 'ArrowRight') step(1)
  else if (i.value !== null && e.key === 'ArrowLeft') step(-1)
}
const strip = ref(null)
let prevOverflow = ''
onMounted(() => {
  window.addEventListener('keydown', onKey)
  prevOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden' // no page scrolling behind
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = prevOverflow
})
</script>

<template>
  <teleport to="body">
    <div class="pv" role="dialog" aria-modal="true" :aria-label="title">
      <!-- grid of all photos -->
      <div v-if="cur === null" class="grid-view">
        <header>
          <div><b>{{ title }}</b><small>{{ n }} bilder</small></div>
          <button class="ic" aria-label="Lukk (Esc)" @click="emit('close')"><X :size="20" /></button>
        </header>
        <div class="scroll"><div class="masonry">
          <button v-for="(p, k) in photos" :key="p.id || k" class="tile" @click="cameFromGrid = true; go(k)">
            <img :src="thumb(p.src, 400)" :alt="p.tekst || ''" loading="lazy" decoding="async" />
          </button>
        </div></div>
      </div>

      <!-- one photo -->
      <div v-else class="one" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
        <header>
          <button class="ic" :aria-label="cameFromGrid ? 'Alle bilder' : 'Lukk'" @click="cameFromGrid ? toGrid() : emit('close')">
            <LayoutGrid v-if="cameFromGrid" :size="18" /><X v-else :size="20" />
          </button>
          <span class="count">{{ i + 1 }} / {{ n }}</span>
          <span class="right">
            <button v-if="!cameFromGrid && n > 1" class="ic" aria-label="Alle bilder" title="Alle bilder" @click="toGrid"><LayoutGrid :size="18" /></button>
            <button v-if="cameFromGrid" class="ic" aria-label="Lukk" @click="emit('close')"><X :size="20" /></button>
          </span>
        </header>
        <div class="stage" :style="{ transform: dx ? `translateX(${dx}px)` : null, transition: dx ? 'none' : null }">
          <img :key="cur.src" class="photo" :src="loaded.has(cur.src) ? cur.src : thumb(cur.src, 900)" :alt="cur.tekst || ''" draggable="false" />
        </div>
        <p v-if="cur.tekst" class="cap">{{ cur.tekst }}</p>
        <button v-if="n > 1" class="nav prev" aria-label="Forrige (←)" @click.stop="step(-1)" @pointerdown.stop><ChevronLeft :size="26" /></button>
        <button v-if="n > 1" class="nav next" aria-label="Neste (→)" @click.stop="step(1)" @pointerdown.stop><ChevronRight :size="26" /></button>
        <div v-if="n > 1" ref="strip" class="strip" @pointerdown.stop>
          <button v-for="(p, k) in photos" :key="p.id || k" :class="{ on: k === i }" :aria-label="`Bilde ${k + 1}`" @click="go(k)">
            <img :src="thumb(p.src, 400)" alt="" loading="lazy" decoding="async" />
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.pv { position: fixed; inset: 0; z-index: 200; background: #05080f; color: #e8eef7; animation: pvIn 0.2s ease; }
@keyframes pvIn { from { opacity: 0; } }
header { display: flex; align-items: center; gap: 12px; padding: max(12px, env(safe-area-inset-top)) 16px 12px; }
header b { display: block; font-size: 1.05rem; }
header small { color: rgba(232, 238, 247, 0.6); font-size: 0.8rem; }
header > div { flex: 1; min-width: 0; }
.ic { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; }
.ic:hover { background: rgba(255, 255, 255, 0.2); }

/* grid */
.grid-view { position: absolute; inset: 0; display: flex; flex-direction: column; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.masonry { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; padding: 0 3px max(16px, env(safe-area-inset-bottom)); }
.tile { display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; border-radius: 2px; overflow: hidden; background: rgba(255, 255, 255, 0.06); cursor: zoom-in; }
.tile img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s var(--ease, ease), opacity 0.2s; }
.tile:hover img { transform: scale(1.03); }
@media (min-width: 640px) { .masonry { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; padding: 0 20px 20px; } .tile { border-radius: 6px; } }

/* one photo */
.one { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: pan-y; user-select: none; }
.one header { position: relative; z-index: 2; }
.count { flex: 1; text-align: center; font-size: 0.85rem; color: rgba(232, 238, 247, 0.7); font-variant-numeric: tabular-nums; }
.right { display: flex; gap: 8px; min-width: 42px; justify-content: flex-end; }
.stage { position: relative; flex: 1; min-height: 0; margin: 0 84px; transition: transform 0.25s var(--ease, ease); }
.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; animation: phIn 0.25s ease; -webkit-user-drag: none; }
@keyframes phIn { from { opacity: 0.4; } }
.cap { margin: 8px auto 0; padding: 0 16px; max-width: 70ch; text-align: center; font-size: 0.92rem; color: rgba(232, 238, 247, 0.85); }
.nav { position: absolute; top: 50%; z-index: 2; display: grid; place-items: center; width: 52px; height: 52px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; transform: translateY(-50%); }
.nav:hover { background: rgba(255, 255, 255, 0.22); }
.prev { left: 16px; }
.next { right: 16px; }
.strip { display: flex; gap: 6px; padding: 12px 16px max(12px, env(safe-area-inset-bottom)); overflow-x: auto; scrollbar-width: none; flex: none; }
.strip::-webkit-scrollbar { display: none; }
.strip button { flex: none; width: 56px; height: 56px; padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.06); cursor: pointer; opacity: 0.55; transition: opacity 0.2s, border-color 0.2s; }
.strip button.on { opacity: 1; border-color: #fff; }
.strip button:hover { opacity: 0.9; }
.strip img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* phones: swipe instead of arrows, smaller strip */
@media (max-width: 640px), (hover: none) {
  .nav { display: none; }
  .stage { margin: 0; }
  .strip button { width: 44px; height: 44px; }
}
</style>
