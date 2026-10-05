<script setup>
import { ref, computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import CoverGrid from './CoverGrid.vue'
import { groups, sectionsOf, moveTo, groupOf, flatGroups, isCollapsed, toggleCollapsed } from '../composables/useGroups'
import { admin } from '../composables/useAdmin'
import { notify } from '../composables/useSpotify'

// The cover grid split into my groups (headings, in my order). With grouping off – or before the groups have
// loaded – it is just the plain grid. In edit mode (admin) every tile has a group picker and can be dragged
// onto another group.
const props = defineProps({
  items: { type: Array, required: true },
  selectedUri: { type: String, default: null },
  playingUri: { type: String, default: null },
  cursorUri: { type: String, default: null },
})
const emit = defineEmits(['pick', 'hover'])

const grouped = computed(() => groups.on && groups.loaded && groups.list.length > 0)
const movable = computed(() => admin.loggedIn && groups.editing)
const sections = computed(() => sectionsOf(props.items, movable.value))
const pickers = computed(() => flatGroups())
// editing shows everything (so a tile can be dropped anywhere); otherwise a section can be folded in
const folded = (s, i) => !movable.value && isCollapsed(s.group.id, i)

async function move(uri, id) {
  const r = await moveTo(uri, id)
  if (!r.ok) notify(r.error, true)
}

// drag a tile onto another group's heading / area
const over = ref(null)
let dragUri = null
function onDragStart(e) {
  const cell = e.target.closest?.('[data-uri]')
  if (!cell) return
  dragUri = cell.dataset.uri
  e.dataTransfer?.setData('text/plain', dragUri)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDrop(e, id) {
  e.preventDefault()
  const uri = dragUri || e.dataTransfer?.getData('text/plain')
  dragUri = null
  over.value = null
  if (uri && id !== '_' && groups.assign[uri] !== id) move(uri, id)
}
</script>

<template>
  <CoverGrid v-if="!grouped" :items="items" :selected-uri="selectedUri" :playing-uri="playingUri" :cursor-uri="cursorUri" @pick="emit('pick', $event)" @hover="emit('hover', $event)" />
  <div v-else class="groups" @dragstart="onDragStart">
    <p v-if="!sections.length" class="empty">Ingenting i denne mappa ennå.</p>
    <section
      v-for="(s, i) in sections"
      :key="s.group.id"
      class="grp"
      :class="{ sub: s.depth > 0, over: movable && over === s.group.id }"
      @dragover.prevent="movable && (over = s.group.id)"
      @dragleave="over === s.group.id && (over = null)"
      @drop="movable && onDrop($event, s.group.id)"
    >
      <h4 class="label-caps">
        <button class="fold" :aria-expanded="!folded(s, i)" :disabled="movable" @click="toggleCollapsed(s.group.id, i)">
          <ChevronRight :size="14" :class="{ open: !folded(s, i) }" aria-hidden="true" />{{ s.label }}<small>{{ s.items.length }}</small>
        </button>
      </h4>
      <CoverGrid
        v-if="s.items.length && !folded(s, i)"
        :items="s.items"
        :selected-uri="selectedUri"
        :playing-uri="playingUri"
        :cursor-uri="cursorUri"
        :movable="movable"
        :groups="pickers"
        :group-of="groupOf"
        :guessed="groups.auto"
        :why="groups.why"
        @pick="emit('pick', $event)"
        @hover="emit('hover', $event)"
        @move="move"
      />
      <p v-else-if="!s.items.length" class="empty">Dra album eller spillelister hit.</p>
    </section>
  </div>
</template>

<style scoped>
.groups { display: grid; gap: 18px; }
.grp { display: grid; gap: 8px; padding: 4px; border-radius: 14px; transition: background 0.15s, outline-color 0.15s; outline: 2px dashed transparent; }
.grp.over { background: var(--accent-soft); outline-color: var(--accent); }
h4 { margin: 0; }
.fold { display: flex; align-items: center; gap: 6px; width: 100%; padding: 4px 2px; border: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; text-align: left; cursor: pointer; }
.fold:disabled { cursor: default; }
.fold svg { flex: none; transition: transform 0.2s; }
.fold svg.open { transform: rotate(90deg); }
.fold small { margin-left: 4px; font-weight: 500; opacity: 0.6; font-variant-numeric: tabular-nums; }
.grp.sub { margin-left: 14px; }
.empty { margin: 0; padding: 12px; border: 1px dashed var(--glass-border); border-radius: 10px; color: var(--text-3); font-size: 0.82rem; text-align: center; }
</style>
