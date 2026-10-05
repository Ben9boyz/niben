<script setup>
import { ref, computed } from 'vue'
import { ListEnd, ListMusic } from 'lucide-vue-next'
import { spotify, enqueue, addToPlaylist, notify } from '../composables/useSpotify'
import { groups, sectionsOf } from '../composables/useGroups'
import { drag, endDrag } from '../composables/useDrag'

// Drag a song and a tray slides in with the queue and my playlists (by group): drop it on one to add it.
const over = ref(null)
const all = computed(() => spotify.playlists.filter((p) => p.editable !== false))
const sections = computed(() => (groups.on && groups.loaded ? sectionsOf(all.value, false, true) : [{ group: { id: 'alle' }, label: '', items: all.value }]))

async function drop(e, target) {
  e.preventDefault()
  over.value = null
  const t = drag.track
  endDrag()
  if (!t) return
  if (target === 'queue') { enqueue(t.uri); return }
  const r = await addToPlaylist(target.uri, t.uri)
  notify(r.ok ? `«${t.name}» er lagt til i «${target.name}».` : r.error, !r.ok)
}
const hint = (e, id) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; over.value = id }
</script>

<template>
  <transition name="fade">
    <aside v-if="drag.track" class="tray glass" aria-label="Slipp låta her">
      <b class="label-caps">Slipp «{{ drag.track.name }}» på …</b>
      <div class="list">
        <div class="row queue" :class="{ over: over === 'queue' }" @dragover="hint($event, 'queue')" @dragleave="over = null" @drop="drop($event, 'queue')"><ListEnd :size="15" />Spill etterpå (kø)</div>
        <template v-for="sec in sections" :key="sec.group.id">
          <small v-if="sec.label">{{ sec.label }}</small>
          <div v-for="p in sec.items" :key="p.uri" class="row" :class="{ over: over === p.uri }" @dragover="hint($event, p.uri)" @dragleave="over = null" @drop="drop($event, p)">
            <ListMusic :size="14" /><span>{{ p.name }}</span>
          </div>
        </template>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.tray { position: fixed; z-index: 80; right: 20px; top: 84px; bottom: 90px; width: min(300px, calc(100vw - 40px)); display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 18px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); }
.list { display: grid; gap: 2px; overflow-y: auto; overscroll-behavior: contain; }
.list small { padding: 8px 8px 2px; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.row { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 10px; border: 1px dashed transparent; color: var(--text); font: 600 0.85rem var(--font); }
.row span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row.queue { border-color: #1db954; color: #1db954; background: color-mix(in srgb, #1db954 10%, transparent); }
.row.over { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
@media (hover: none) { .tray { display: none; } }
</style>
