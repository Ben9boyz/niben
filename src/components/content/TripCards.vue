<script setup lang="ts">
import { Images } from 'lucide-vue-next'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { thumb } from '@/lib/photos'
import PhotoViewer from './PhotoViewer.vue'
import type { Trip } from '@/composables/useData'

withDefaults(defineProps<{ trips?: Trip[] }>(), { trips: () => [] })

function year(t: Trip) { return t.aar || (t.dato ? Number(String(t.dato).slice(0, 4)) : null) }
function when(t: Trip) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  if (t.dato && t.til && t.til !== t.dato) {
    const a = new Date(t.dato), b = new Date(t.til)
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    return sameMonth ? `${a.getDate()}.–${fmt(t.til)}` : `${fmt(t.dato)} – ${fmt(t.til)}`
  }
  return t.dato ? fmt(t.dato) : ''
}

// a few photos as a mosaic on the card; the rest are one tap away in the full-screen viewer
// (narrow: 3 columns – big + 5; wide: 4 columns – big + 4, two rows either way)
const root = ref<HTMLElement | null>(null)
const wide = ref(false)
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => { wide.value = (e?.contentRect.width ?? 0) >= 560 })
  if (root.value) ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())
const SHOWN = (n: number) => (n >= 6 ? (wide.value ? 5 : 6) : n >= 3 ? 3 : n)
const viewer = ref<{ trip: Trip; index: number | null } | null>(null) // index null = the grid of all photos
const open = (trip: Trip, index: number | null = null) => { viewer.value = { trip, index } }
</script>

<template>
  <div ref="root" class="trips" :class="{ wide }">
    <article v-for="(t, i) in trips" :key="t.id || i" class="trip" :style="{ '--i': i }">
      <div class="trip-body">
        <div class="muted">
          <span v-if="year(t)" class="year">{{ year(t) }}</span>
          {{ [t.sted, when(t)].filter(Boolean).join(' · ') }}
        </div>
        <h3>{{ t.tittel }}</h3>
        <p v-if="t.tekst" class="body">{{ t.tekst }}</p>
      </div>
      <template v-if="t.bilder?.length">
        <div class="mosaic" :class="`n${SHOWN(t.bilder.length)}`">
          <button v-for="(b, j) in t.bilder.slice(0, SHOWN(t.bilder.length))" :key="b.id || j" class="ph" :aria-label="b.tekst || `Bilde ${j + 1}`" @click="open(t, j === SHOWN(t.bilder.length) - 1 && t.bilder.length > SHOWN(t.bilder.length) ? null : j)">
            <img :src="thumb(b.src, j === 0 ? 900 : 400)" :alt="b.tekst || ''" loading="lazy" decoding="async" />
            <span v-if="j === SHOWN(t.bilder.length) - 1 && t.bilder.length > SHOWN(t.bilder.length)" class="more">+{{ t.bilder.length - SHOWN(t.bilder.length) }}</span>
          </button>
        </div>
        <button v-if="t.bilder.length > 1" class="all" @click="open(t)"><Images :size="16" />Se alle {{ t.bilder.length }} bildene</button>
      </template>
    </article>

    <PhotoViewer
      v-if="viewer"
      :title="viewer.trip.tittel"
      :photos="viewer.trip.bilder"
      v-model:index="viewer.index"
      @close="viewer = null"
    />
  </div>
</template>

<style scoped>
.trip {
  margin-bottom: 12px; border-radius: 20px; overflow: hidden; background: var(--glass-strong); border: 1px solid var(--glass-border);
  animation: rowIn 0.6s var(--ease) both; animation-delay: calc(var(--i) * 70ms);
}
.mosaic { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 0 8px; }
.mosaic.n1 { grid-template-columns: 1fr; }
.mosaic.n2 { grid-template-columns: 1fr 1fr; }
.ph { position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; border-radius: 6px; overflow: hidden; cursor: zoom-in; background: var(--accent-soft); }
.mosaic.n1 .ph { aspect-ratio: 3 / 2; }
.mosaic.n3 .ph:first-child, .mosaic.n6 .ph:first-child { grid-column: span 2; grid-row: span 2; aspect-ratio: auto; }
.mosaic .ph:first-child { border-top-left-radius: 12px; }
.ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s var(--ease); }
.ph:hover img { transform: scale(1.04); }
.more { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(5, 10, 20, 0.55); color: #fff; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }
.all { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 16px); margin: 6px 8px 8px; padding: 10px; border: 0; border-radius: 12px; background: var(--accent-soft); color: var(--accent); font: 600 0.88rem var(--font); cursor: pointer; }
.all:hover { filter: brightness(1.05); }
/* wide cards: four columns, so six photos make two rows */
.wide .mosaic.n5, .wide .mosaic.n3 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.wide .mosaic.n5 .ph:first-child { grid-column: span 2; grid-row: span 2; aspect-ratio: auto; }
.wide .mosaic.n3 .ph:first-child { grid-column: span 2; grid-row: span 2; aspect-ratio: auto; }
.wide .mosaic.n3 .ph:not(:first-child) { grid-column: span 2; aspect-ratio: 2 / 1; }
.trip-body { padding: 14px 16px 16px; }
.muted { color: var(--text-3); font-size: 0.88rem; }
.year { display: inline-block; padding: 2px 8px; margin-right: 4px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 0.75rem; }
.trip h3 { font-size: 1.15rem; margin-top: 6px; }
.body { margin-top: 6px; font-size: 0.94rem; color: var(--text-2); white-space: pre-line; }

@container (min-width: 560px) {
  .trip h3 { font-size: 1.5rem; }
  .body { font-size: 1.02rem; }
}
</style>
