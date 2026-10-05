<script setup>
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import FolderIcon from './FolderIcon.vue'
import { spotify } from '../composables/useSpotify'
import { ref } from 'vue'
import { groups, topGroups, childrenOf, countIn, groupCover, moveTo } from '../composables/useGroups'
import { admin } from '../composables/useAdmin'
import { drag, endDrag } from '../composables/useDrag'
import { notify } from '../composables/useSpotify'

// The folders under the library (PC): click one to show just that folder in the grid, click it again for all.
// A folder with folders inside folds in and out.
const props = defineProps({
  kind: { type: String, default: 'album' }, // which list the numbers count
  active: { type: Boolean, default: true }, // is this the list I'm looking at (only then is a folder lit)
})
const emit = defineEmits(['pick'])
const uris = computed(() => (props.kind === 'playlist' ? spotify.playlists : spotify.albums).map((x) => x.uri))
// drop an album / playlist tile on a folder to move it there
const over = ref(null)
const allow = (e, id) => { if (admin.loggedIn && drag.item) { e.preventDefault(); over.value = id } }
async function drop(e, id) {
  e.preventDefault()
  const uri = drag.item
  over.value = null
  endDrag()
  if (!uri || groups.assign[uri] === id) return
  const r = await moveTo(uri, id)
  if (!r.ok) notify(r.error, true)
}
const isOpen = (id) => groups.treeOpen[id] !== false
const toggle = (id) => { groups.treeOpen = { ...groups.treeOpen, [id]: !isOpen(id) } }
</script>

<template>
  <nav v-if="groups.on && groups.loaded" class="ft" :aria-label="`Mapper for ${kind === 'playlist' ? 'spillelister' : 'album'}`">
    <template v-for="g in topGroups()" :key="g.id">
      <div class="r">
        <button v-if="childrenOf(g.id).length" class="chev" :aria-label="isOpen(g.id) ? 'Brett inn' : 'Brett ut'" :aria-expanded="isOpen(g.id)" @click="toggle(g.id)"><ChevronRight :size="13" :class="{ open: isOpen(g.id) }" /></button>
        <span v-else class="chev"></span>
        <button class="f" :class="{ on: active && groups.sel === g.id, over: over === g.id }" @click="emit('pick', g.id)" @dragover="allow($event, g.id)" @dragleave="over === g.id && (over = null)" @drop="drop($event, g.id)">
          <FolderIcon :image="groupCover(g.id)" :size="16" :open="active && groups.sel === g.id" /><span class="nm">{{ g.name }}</span><small>{{ countIn(g.id, uris) }}</small>
        </button>
      </div>
      <template v-if="isOpen(g.id)">
        <div v-for="c in childrenOf(g.id)" :key="c.id" class="r sub">
          <span class="chev"></span>
          <button class="f" :class="{ on: active && groups.sel === c.id, over: over === c.id }" @click="emit('pick', c.id)" @dragover="allow($event, c.id)" @dragleave="over === c.id && (over = null)" @drop="drop($event, c.id)">
            <FolderIcon :image="groupCover(c.id)" :size="14" :open="active && groups.sel === c.id" /><span class="nm">{{ c.name }}</span><small>{{ countIn(c.id, uris) }}</small>
          </button>
        </div>
      </template>
    </template>
  </nav>
</template>

<style scoped>
.ft { display: grid; gap: 1px; padding: 2px 0 6px 10px; }
.lh { margin: 4px 6px 4px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.r { display: flex; align-items: center; gap: 0; }
.r.sub { padding-left: 16px; }
.chev { flex: none; display: grid; place-items: center; width: 18px; height: 28px; border: 0; background: transparent; color: var(--text-3); cursor: pointer; }
.chev svg { transition: transform 0.18s; }
.chev svg.open { transform: rotate(90deg); }
.f { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 0; border-radius: 10px; background: transparent; color: var(--text-2); font: 600 0.85rem var(--font); text-align: left; cursor: pointer; }
.f .nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.f small { font-weight: 500; opacity: 0.6; font-variant-numeric: tabular-nums; }
.f:hover { background: var(--accent-soft); color: var(--text); }
.f.over { background: var(--accent); color: #fff; }
.f.on { background: var(--accent-soft); color: var(--accent); }
.all { margin: 4px 6px 0; padding: 5px 10px; border: 0; border-radius: 999px; background: transparent; color: var(--accent); font: 600 0.76rem var(--font); text-align: left; cursor: pointer; }
</style>
