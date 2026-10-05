<script setup>
import { computed } from 'vue'
import { Folder, FolderOpen, ChevronRight } from 'lucide-vue-next'
import { spotify } from '../composables/useSpotify'
import { groups, topGroups, childrenOf, countIn, select } from '../composables/useGroups'

// The folders under the library (PC): click one to show just that folder in the grid, click it again for all.
// A folder with folders inside folds in and out.
const props = defineProps({ kind: { type: String, default: 'album' } }) // which list the numbers count
const uris = computed(() => (props.kind === 'playlist' ? spotify.playlists : spotify.albums).map((x) => x.uri))
const isOpen = (id) => groups.treeOpen[id] !== false
const toggle = (id) => { groups.treeOpen = { ...groups.treeOpen, [id]: !isOpen(id) } }
</script>

<template>
  <nav v-if="groups.on && groups.loaded" class="ft" aria-label="Mapper">
    <b class="lh">Mapper</b>
    <template v-for="g in topGroups()" :key="g.id">
      <div class="r">
        <button v-if="childrenOf(g.id).length" class="chev" :aria-label="isOpen(g.id) ? 'Brett inn' : 'Brett ut'" :aria-expanded="isOpen(g.id)" @click="toggle(g.id)"><ChevronRight :size="13" :class="{ open: isOpen(g.id) }" /></button>
        <span v-else class="chev"></span>
        <button class="f" :class="{ on: groups.sel === g.id }" @click="select(g.id)">
          <component :is="groups.sel === g.id ? FolderOpen : Folder" :size="15" aria-hidden="true" /><span>{{ g.name }}</span><small>{{ countIn(g.id, uris) }}</small>
        </button>
      </div>
      <template v-if="isOpen(g.id)">
        <div v-for="c in childrenOf(g.id)" :key="c.id" class="r sub">
          <span class="chev"></span>
          <button class="f" :class="{ on: groups.sel === c.id }" @click="select(c.id)">
            <component :is="groups.sel === c.id ? FolderOpen : Folder" :size="14" aria-hidden="true" /><span>{{ c.name }}</span><small>{{ countIn(c.id, uris) }}</small>
          </button>
        </div>
      </template>
    </template>
    <button v-if="groups.sel" class="all" @click="select(groups.sel)">Vis alle</button>
  </nav>
</template>

<style scoped>
.ft { display: grid; gap: 1px; padding-top: 8px; margin-top: 4px; border-top: 1px solid var(--glass-border); }
.lh { margin: 4px 6px 4px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.r { display: flex; align-items: center; gap: 0; }
.r.sub { padding-left: 16px; }
.chev { flex: none; display: grid; place-items: center; width: 18px; height: 28px; border: 0; background: transparent; color: var(--text-3); cursor: pointer; }
.chev svg { transition: transform 0.18s; }
.chev svg.open { transform: rotate(90deg); }
.f { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 0; border-radius: 10px; background: transparent; color: var(--text-2); font: 600 0.85rem var(--font); text-align: left; cursor: pointer; }
.f span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.f small { font-weight: 500; opacity: 0.6; font-variant-numeric: tabular-nums; }
.f:hover { background: var(--accent-soft); color: var(--text); }
.f.on { background: var(--accent-soft); color: var(--accent); }
.all { margin: 4px 6px 0; padding: 5px 10px; border: 0; border-radius: 999px; background: transparent; color: var(--accent); font: 600 0.76rem var(--font); text-align: left; cursor: pointer; }
</style>
