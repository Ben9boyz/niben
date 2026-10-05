<script setup>
import { ref, computed } from 'vue'
import { Disc3, ListMusic, Search, X } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { spotify, useSpotify } from '../composables/useSpotify'
import { loadGroups } from '../composables/useGroups'
import { peek, peekBack, peekClear } from '../composables/useBrowse'
import NowPlaying from '../components/NowPlaying.vue'
import QueuePanel from '../components/QueuePanel.vue'
import VinylPanel from '../components/VinylPanel.vue'
import PlaylistPanel from '../components/PlaylistPanel.vue'
import SpotifySearch from '../components/SpotifySearch.vue'
import SegSwitch from '../components/SegSwitch.vue'
import MusicDetail from '../components/MusicDetail.vue'
import ArtistPage from '../components/ArtistPage.vue'

// The listening corner's side panel in the 3D room: the same pieces as the plain music page – now playing +
// the queue, the Album / Spillelister switch, one search, the grid – just stacked in one column.
useSpotify()
loadGroups()
const gq = ref('')
const ipod = computed(() => room.musicView.startsWith('ipod'))
const playing = computed(() => !!spotify.now?.name)
const LIB = [{ id: 'vinyl', label: 'Album', icon: Disc3 }, { id: 'ipod', label: 'Spillelister', icon: ListMusic }]
const view = computed({
  get: () => (ipod.value ? 'ipod' : 'vinyl'),
  set: (v) => {
    gq.value = ''
    peekClear()
    if (v === 'ipod') { room.musicView = 'ipodDock'; room.sel.musikk = null } else { room.musicView = 'vinyl'; room.sel.musikk = null }
  },
})
const top = computed(() => peek.stack[peek.stack.length - 1] || null)
</script>

<template>
  <section class="panel glass music-panel">
    <div class="panel-body">
      <div class="np-sticky">
        <NowPlaying v-if="playing" />
        <QueuePanel v-if="playing" class="queue" />
      </div>
      <div class="bar">
        <SegSwitch v-model="view" :items="LIB" stretch label="Bibliotek" />
        <label class="gsearch">
          <Search :size="16" aria-hidden="true" />
          <input v-model="gq" type="search" placeholder="Søk i spillelister, album og låter …" aria-label="Søk i musikken" />
          <button v-if="gq" type="button" aria-label="Tøm søket" @click="gq = ''"><X :size="15" /></button>
        </label>
      </div>
      <template v-if="top">
        <MusicDetail v-if="top.kind === 'album'" :key="top.item.uri" :item="top.item" kind="album" back-label="Tilbake" @back="peekBack" />
        <ArtistPage v-else :key="top.item.id || top.item.name" :artist="top.item" back-label="Tilbake" @back="peekBack" />
      </template>
      <SpotifySearch v-else-if="gq.trim()" :q="gq" scope="all" :tab="ipod ? 'ipod' : 'vinyl'" />
      <PlaylistPanel v-else-if="ipod" :search="false" />
      <VinylPanel v-else :search="false" />
    </div>
  </section>
</template>

<style scoped>
.music-panel .panel-body { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 12px; padding-top: 0; container-type: inline-size; }
/* now playing + queue stay put while the albums and playlists scroll underneath */
.np-sticky { position: sticky; top: 0; z-index: 4; padding-top: 14px; display: grid; gap: 8px; margin: 0 -2px; background: linear-gradient(var(--bg) 70%, transparent); }
.np-sticky :deep(.now) { box-shadow: inset 0 1px 0 var(--glass-hi), 0 8px 24px rgba(0, 0, 0, 0.1); }
.queue { background: transparent; border: 0; padding: 0; max-height: 150px; overflow-y: auto; scrollbar-width: none; }
.bar { display: grid; gap: 8px; }
.gsearch { display: flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text-3); }
.gsearch:focus-within { border-color: var(--accent); color: var(--accent); }
.gsearch input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.92rem var(--font); }
.gsearch input::-webkit-search-cancel-button { display: none; }
.gsearch button { display: grid; place-items: center; border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 0; }
</style>
