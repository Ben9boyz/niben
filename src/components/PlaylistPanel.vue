<script setup>
import { ref, computed } from 'vue'
import { sorted } from '../composables/useSort'
import { spotify, prefetchTracks } from '../composables/useSpotify'
import { room } from '../composables/useRoom'
import GroupedGrid from './GroupedGrid.vue'
import GroupBar from './GroupBar.vue'
import { loadGroups } from '../composables/useGroups'
import MusicDetail from './MusicDetail.vue'

// Panel twin of the iPod: same selected playlist, same highlighted row (room.ipod) – and the same
// search text, so typing here filters the iPod's list too.
defineProps({ search: { type: Boolean, default: true } }) // false: the page has its own search bar
loadGroups()
const q = computed({ get: () => room.ipod.q, set: (v) => { room.ipod.q = v; room.ipod.active = 0 } })
const playlist = computed(() => room.ipod.playlist)
const items = computed(() => {
  const n = q.value.trim().toLowerCase()
  const list = n ? spotify.playlists.filter((p) => p.name.toLowerCase().includes(n)) : spotify.playlists
  return sorted('playlist', list).map((p) => ({ uri: p.uri, name: p.name, sub: p.count ? `${p.count} låter` : p.owner, image: p.image || p.thumb }))
})
const cursorUri = computed(() => (q.value ? null : spotify.playlists[room.ipod.active]?.uri))

function open(it) {
  if (room.musicView === 'ipodDock') room.musicView = 'ipod' // lift the iPod up
  room.ipod.playlist = spotify.playlists.find((p) => p.uri === it.uri)
  room.ipod.view = 'playlist'
  room.ipod.active = 0
}
function hover(it) {
  prefetchTracks(it.uri)
  if (q.value) return
  const i = spotify.playlists.findIndex((p) => p.uri === it.uri)
  if (i >= 0) room.ipod.active = i
}
function back() {
  room.ipod.active = Math.max(0, spotify.playlists.findIndex((x) => x.uri === playlist.value?.uri))
  room.ipod.view = 'menu'
  room.ipod.playlist = null
}
</script>

<template>
  <div class="pp">
    <transition name="fade" mode="out-in">
      <MusicDetail v-if="playlist" :key="playlist.uri" :item="playlist" kind="playlist" back-label="Alle spillelister" @back="back" />

      <div v-else class="browse">
        <div class="stick"><div class="head">
          <b>Spillelister</b>
          <input v-if="search" v-model="q" type="search" class="search" placeholder="Søk …" aria-label="Søk i spillelistene" />
        </div>
        <GroupBar />
        </div>
        <GroupedGrid :flat="!!q.trim()" :items="items" :playing-uri="spotify.now?.context" :cursor-uri="cursorUri" @pick="open" @hover="hover" />
        <p v-if="!items.length" class="muted">Ingen treff.</p>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.stick { min-width: 0; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px 16px; }
.stick .head { flex: 0 0 auto; margin: 0 2px; padding-bottom: 6px; }
.stick :deep(.gb) { flex: 1 1 280px; min-width: 0; max-width: 100%; }
.stick :deep(.gb .gbrow) { justify-content: flex-end; }
.stick .head b { font-size: 1.05rem; letter-spacing: 0.04em; color: var(--text-2); }
.pp { container-type: inline-size; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.browse { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.muted { color: var(--text-3); font-size: 0.85rem; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 2px 2px 0; }
.head b { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.search { width: 160px; min-width: 0; flex: 0 1 160px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 500 0.82rem var(--font); outline: none; }
.search:focus { border-color: var(--accent); }
@media (max-width: 820px) {
  /* phones: the name on top, the buttons spread over the whole width underneath */
  .stick { flex-direction: column; align-items: stretch; gap: 8px; }
  .stick :deep(.gb) { flex: 0 0 auto; }
  .stick .head { padding-bottom: 0; }
  .stick :deep(.gb .gbrow) { justify-content: space-between; }
}
/* narrow panel (the 3D side panel, the floating player): the name on top, the buttons spread over one line under it */
@container (max-width: 640px) {
  .stick { flex-direction: column; align-items: stretch; gap: 8px; }
  .stick .head { padding-bottom: 0; }
  .stick :deep(.gb) { flex: 0 0 auto; }
  .stick :deep(.gb .gbrow) { justify-content: space-between; }
}
</style>
