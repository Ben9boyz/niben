<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useData } from '@/composables/site/useData'
import { room } from '@/composables/room/useRoom'
import FigureViewer from './FigureViewer.vue'

// The figures on the shelf: the list, and one figure at a time – turned around on a stage with its name and description.
// Shared by the side panel in the 3D room and the plain version.
const data = useData()
const list = computed(() => data.figurer || [])
const f = computed(() => list.value[room.sel.figur] ?? null)
</script>

<template>
  <div class="fc">
    <transition name="fade" mode="out-in">
      <div v-if="f" :key="f.id" class="detail">
        <button class="back" @click="room.sel.figur = -1"><ChevronLeft :size="16" />Alle figurer</button>
        <FigureViewer :figure="f" />
        <h3>{{ f.name }}</h3>
        <p v-if="f.desc" class="desc">{{ f.desc }}</p>
        <p v-else class="muted">Ingen beskrivelse ennå.</p>
      </div>
      <div v-else key="list" class="list">
        <button v-for="(item, i) in list" :key="item.id" class="row" @click="room.sel.figur = i">
          <span class="meta"><span class="name">{{ item.name }}</span><span v-if="item.desc" class="sub">{{ item.desc }}</span></span>
          <ChevronRight :size="18" />
        </button>
        <p v-if="!list.length" class="muted">Ingen figurer er lagt på hylla ennå.</p>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fc { display: grid; gap: 10px; }
.detail { display: grid; gap: 10px; }
.back { justify-self: start; display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--text-2); font: 600 0.84rem var(--font); cursor: pointer; padding: 4px 6px 4px 0; }
.back:hover { color: var(--accent); }
h3 { margin: 0; font-size: 1.15rem; }
.desc { margin: 0; color: var(--text-2); line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
.muted { color: var(--text-3); font-size: 0.9rem; margin: 0; }
.list { display: grid; gap: 6px; }
.row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 0; border-radius: 14px; background: var(--accent-soft); color: var(--text); text-align: left; cursor: pointer; font: inherit; }
.row:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.meta { flex: 1; min-width: 0; display: grid; }
.name { font-weight: 600; }
.sub { color: var(--text-3); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
