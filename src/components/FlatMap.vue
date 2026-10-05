<script setup lang="ts">
import { ref, computed } from 'vue'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldTopo from 'world-atlas/countries-110m.json'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { norskNavn } from '../three/countries'

const props = withDefaults(defineProps<{ visited?: Set<string>; selected?: string | null }>(), { visited: () => new Set<string>(), selected: null })
const emit = defineEmits<{ select: [name: string | null] }>()

const W = 960, H = 470
const topo = worldTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
const features = feature(topo, topo.objects.countries).features.filter((f) => f.properties.name !== 'Antarctica')
const projection = geoEqualEarth().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'FeatureCollection', features })
const path = geoPath(projection)
const shapes = features.map((f) => ({ name: f.properties.name, d: path(f) }))

const hover = ref<string | null>(null)
const tip = ref({ x: 0, y: 0 })
function move(e: MouseEvent, s: { name: string }) {
  hover.value = s.name
  const r = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect()
  if (!r) return
  tip.value = { x: e.clientX - r.left, y: e.clientY - r.top }
}
const ordered = computed(() => {
  // draw visited + selected last so their outline sits on top
  const rank = (n: string) => (n === props.selected ? 2 : props.visited.has(n) ? 1 : 0)
  return [...shapes].sort((a, b) => rank(a.name) - rank(b.name))
})
</script>

<template>
  <div class="map">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="Verdenskart">
      <path
        v-for="s in ordered"
        :key="s.name"
        :d="s.d || undefined"
        :class="{ visited: visited.has(s.name), selected: s.name === selected, hover: s.name === hover }"
        @mousemove="move($event, s)"
        @mouseleave="hover = null"
        @click="emit('select', s.name === selected ? null : s.name)"
      />
    </svg>
    <div v-if="hover" class="tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
      {{ norskNavn(hover) }}<span v-if="visited.has(hover)"> · besøkt</span>
    </div>
  </div>
</template>

<style scoped>
.map { position: relative; }
svg { width: 100%; height: auto; display: block; }
path {
  fill: var(--map-land, #e3eaf3);
  stroke: var(--map-stroke, rgba(80, 110, 150, 0.35));
  stroke-width: 0.5;
  cursor: pointer;
  transition: fill 0.25s;
}
:root[data-theme="dark"] path { --map-land: #1e2a3d; --map-stroke: rgba(150, 180, 220, 0.25); }
path.hover { fill: color-mix(in srgb, var(--accent) 30%, var(--map-land, #e3eaf3)); }
path.visited { fill: var(--accent); stroke: rgba(255, 255, 255, 0.7); }
path.visited.hover { fill: color-mix(in srgb, var(--accent) 80%, #fff); }
path.selected { fill: #f0a040; stroke: #fff; stroke-width: 1; }
.tip {
  position: absolute;
  transform: translate(12px, -130%);
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--glass-strong);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-1);
  pointer-events: none;
  white-space: nowrap;
}
.tip span { color: var(--accent); }
</style>
