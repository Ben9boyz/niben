<script setup lang="ts" generic="T extends GridItem">
import { ref, computed } from 'vue'
import { ChevronRight, ChevronLeft } from 'lucide-vue-next'
import CoverGrid from './CoverGrid.vue'
import FolderIcon from './FolderIcon.vue'
import { User, Users } from 'lucide-vue-next'
import { groups, sectionsOf, type Section, moveTo, groupOf, flatGroups, isCollapsed, toggleCollapsed, groupCover, topGroups, childrenOf, countIn, openFolder } from '../composables/useGroups'
import { admin } from '../composables/useAdmin'
import { drag, startItemDrag, endDrag } from '../composables/useDrag'
import { notify } from '../composables/useSpotify'
import { targetEl } from '../lib/dom'
import type { Group, GridItem } from '../types'

// The cover grid split into my groups (headings, in my order). With grouping off – or before the groups have
// loaded – it is just the plain grid. In edit mode (admin) every tile has a group picker and can be dragged
// onto another group.
const props = withDefaults(defineProps<{
  items: T[]
  selectedUri?: string | null
  playingUri?: string | null
  cursorUri?: string | null
  flat?: boolean // searching: just the matches, no folders
  byArtist?: boolean // albums: may be grouped by artist (the third view)
}>(), { selectedUri: null, playingUri: null, cursorUri: null })
const emit = defineEmits<{ pick: [item: T]; hover: [item: T] }>()

const grouped = computed(() => groups.on && groups.loaded && groups.list.length > 0)
// which view: folders in the grid · sections · albums by artist (only for albums)
const viewMode = computed(() => (groups.view === 'artist' ? (props.byArtist ? 'artist' : 'mapper') : groups.view))
const plain = computed(() => !groups.on || props.flat || (viewMode.value !== 'artist' && !grouped.value))
const artistSections = computed<Section<T>[]>(() => {
  const by = new Map<string, T[]>()
  const picked = groups.artist
  if (picked) { // one artist picked in the list on the left
    const its = props.items.filter((i) => (i.sub || 'Ukjent artist') === picked)
    return its.length ? [{ group: { id: `artist:${picked}`, name: picked }, items: its, depth: 0, label: picked }] : []
  }
  for (const it of props.items) { const k = it.sub || 'Ukjent artist'; const list = by.get(k); if (list) list.push(it); else by.set(k, [it]) }
  const nb = (a: string, b: string) => a.localeCompare(b, 'nb')
  // artists with several albums get a section each (most first); the rest share one, A–Å
  const many = [...by.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length || nb(a[0], b[0]))
  const one = [...by.values()].filter((v) => v.length === 1).flatMap((v) => v).sort((a, b) => nb(a.sub || '', b.sub || ''))
  const out: Section<T>[] = many.map(([name, its]) => ({ group: { id: `artist:${name}`, name }, items: its, depth: 0, label: name }))
  if (one.length) out.push({ group: { id: 'artist:_en', name: 'Én plate hver' }, items: one, depth: 0, label: 'Én plate hver' })
  return out
})
const canDrag = computed(() => admin.loggedIn && grouped.value && !props.flat && viewMode.value !== 'artist') // drag & drop works whenever I'm logged in
const movable = computed(() => admin.loggedIn && groups.editing) // edit mode: pickers (touch screens), badges, empty folders
const sections = computed(() => (viewMode.value === 'artist' ? artistSections.value : sectionsOf(props.items, movable.value)))
const pickers = computed(() => flatGroups())

// ── folders as tiles in the grid ──
const uris = computed(() => props.items.map((i) => i.uri))
const cur = computed(() => (groups.list.some((g) => g.id === groups.sel) ? groups.sel : null)) // the folder I'm in
const curGroup = computed(() => groups.list.find((g) => g.id === cur.value) || null)
const parentOfCur = computed(() => { const p = curGroup.value?.parent; return p ? groups.list.find((g) => g.id === p) : null })
const folders = computed(() => (cur.value ? childrenOf(cur.value) : topGroups()).filter((g) => canDrag.value || countIn(g.id, uris.value) > 0))
const itemsHere = computed(() => props.items.filter((it) => { const a = groups.assign[it.uri]; return cur.value ? a === cur.value : !groups.list.some((g) => g.id === a) }))
// editing shows everything (so a tile can be dropped anywhere); otherwise a section can be folded in
const folded = (s: Section<T>, i: number) => !movable.value && isCollapsed(s.group.id, i)

async function move(uri: string, id: string) {
  const r = await moveTo(uri, id)
  if (!r.ok) notify(r.error ?? '', true)
}

// drag a tile onto another group's heading / area
const over = ref<string | null>(null)
function onDragStart(e: DragEvent) {
  const cell = targetEl(e).closest<HTMLElement>('[data-uri]')
  if (cell?.dataset.uri) startItemDrag(e, cell.dataset.uri)
}
function onDrop(e: DragEvent, id: string) {
  e.preventDefault()
  const uri = drag.item
  over.value = null
  endDrag()
  if (uri && id !== '_' && groups.assign[uri] !== id) move(uri, id)
}
const allow = (e: DragEvent, id: string) => { if (canDrag.value && drag.item) { e.preventDefault(); over.value = id } }
</script>

<template>
  <CoverGrid v-if="plain" :items="items" :selected-uri="selectedUri" :playing-uri="playingUri" :cursor-uri="cursorUri" :draggable="admin.loggedIn" @dragstart="onDragStart" @dragend="endDrag" @pick="emit('pick', $event)" @hover="emit('hover', $event)" />
  <div v-else-if="viewMode === 'mapper'" class="fb" @dragstart="onDragStart" @dragend="endDrag">
    <nav v-if="cur" class="crumbs" aria-label="Mappesti">
      <button @click="openFolder(null)"><ChevronLeft :size="14" aria-hidden="true" />Alle</button>
      <template v-if="parentOfCur"><ChevronRight :size="12" aria-hidden="true" /><button :class="{ over: over === parentOfCur.id }" @click="openFolder(parentOfCur.id)" @dragover="allow($event, parentOfCur.id)" @dragleave="over === parentOfCur.id && (over = null)" @drop="canDrag && onDrop($event, parentOfCur.id)">{{ parentOfCur.name }}</button></template>
      <ChevronRight :size="12" aria-hidden="true" /><b>{{ curGroup?.name }}</b>
    </nav>
    <CoverGrid
      :items="itemsHere"
      :selected-uri="selectedUri"
      :playing-uri="playingUri"
      :cursor-uri="cursorUri"
      :draggable="canDrag"
      :movable="movable"
      :groups="pickers"
      :group-of="groupOf"
      :guessed="groups.auto"
      :why="groups.why"
      @pick="emit('pick', $event)"
      @hover="emit('hover', $event)"
      @move="move"
    >
      <template #lead>
        <button
          v-for="f in folders"
          :key="f.id"
          class="ftile"
          :class="{ over: over === f.id, empty: !countIn(f.id, uris) }"
          :aria-label="`Åpne mappa ${f.name}`"
          @click="openFolder(f.id)"
          @dragover="allow($event, f.id)"
          @dragleave="over === f.id && (over = null)"
          @drop="canDrag && onDrop($event, f.id)"
        >
          <FolderIcon :image="groupCover(f.id)" :size="52" />
          <span class="fn"><b>{{ f.name }}</b><small>{{ countIn(f.id, uris) }}</small></span>
        </button>
      </template>
    </CoverGrid>
    <p v-if="!folders.length && !itemsHere.length" class="empty">Mappa er tom.</p>
  </div>
  <div v-else class="groups" @dragstart="onDragStart" @dragend="endDrag">
    <p v-if="!sections.length" class="empty">Ingenting i denne mappa ennå.</p>
    <section
      v-for="(s, i) in sections"
      :key="s.group.id"
      class="grp"
      :class="{ sub: s.depth > 0, over: over === s.group.id }"
      @dragover="allow($event, s.group.id)"
      @dragleave="over === s.group.id && (over = null)"
      @drop="canDrag && onDrop($event, s.group.id)"
    >
      <h4 class="label-caps">
        <button class="fold" :aria-expanded="!folded(s, i)" :disabled="movable" @click="toggleCollapsed(s.group.id, i)">
          <ChevronRight :size="14" :class="{ open: !folded(s, i) }" aria-hidden="true" /><template v-if="s.group.id.startsWith('artist:')"><img v-if="s.group.id !== 'artist:_en' && s.items[0]?.image" crossorigin="anonymous" :src="s.items[0].image" alt="" class="apic" /><span v-else class="apic ph"><Users v-if="s.group.id === 'artist:_en'" :size="12" /><User v-else :size="12" /></span></template>
          <FolderIcon v-else-if="s.group.id !== '_'" :image="groupCover(s.group.id)" :size="16" :open="!folded(s, i)" />{{ s.label }}<small>{{ s.items.length }}</small>
        </button>
      </h4>
      <CoverGrid
        v-if="s.items.length && !folded(s, i)"
        :items="s.items"
        :selected-uri="selectedUri"
        :playing-uri="playingUri"
        :cursor-uri="cursorUri"
        :draggable="canDrag"
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
.apic { flex: none; width: 22px; height: 22px; border-radius: 50%; object-fit: cover; background: var(--glass-strong); }
.apic.ph { display: inline-grid; place-items: center; color: var(--text-3); }
.groups { display: grid; gap: 18px; }
@media (max-width: 820px) { .groups { gap: 4px; } .grp { padding: 2px; } .fold { padding: 8px 2px; } }
.fb { display: grid; gap: 10px; }
.crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; color: var(--text-3); font-size: 0.82rem; }
.crumbs button { display: inline-flex; align-items: center; gap: 2px; padding: 4px 9px; border: 0; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: 600 0.8rem var(--font); cursor: pointer; }
.crumbs b { color: var(--text); font-size: 0.85rem; }
.ftile { aspect-ratio: 1; display: grid; justify-items: center; align-content: center; gap: 8px; min-width: 0; padding: 8px; border: 0; border-radius: 8px; background: var(--glass-strong); color: var(--text); cursor: pointer; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18); transition: transform 0.2s var(--ease, ease), box-shadow 0.2s, outline-color 0.15s; outline: 3px dashed transparent; outline-offset: 2px; }
.ftile:hover { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28); }
.ftile.empty { opacity: 0.7; }
.crumbs button.over { background: var(--accent); color: #fff; }
.ftile.over { outline-color: var(--accent); background: var(--accent-soft); }
.fn { display: grid; justify-items: center; max-width: 100%; text-align: center; }
.fn b { max-width: 100%; font-size: 0.78rem; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fn small { color: var(--text-3); font-size: 0.68rem; font-variant-numeric: tabular-nums; }
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
