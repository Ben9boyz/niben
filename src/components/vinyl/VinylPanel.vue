<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { spotify, useSpotify, prefetchTracks, findAlbum } from '@/composables/useSpotify'
import { admin, checkLogin } from '@/composables/useAdmin'
import { room } from '@/composables/useRoom'
import { mode } from '@/composables/useMode'
import GroupedGrid from '@/components/music/GroupedGrid.vue'
import GroupBar from '@/components/music/GroupBar.vue'
import { loadGroups } from '@/composables/useGroups'
import { sorted } from '@/composables/useSort'
import MusicDetail from '@/components/music/MusicDetail.vue'
import SpotifySearch from '@/components/music/SpotifySearch.vue'
import { Search as SearchIcon, X as CloseIcon } from 'lucide-vue-next'
import type { Flash, GridItem } from '@/types'

// The record shelf: a grid of covers, or one record opened (mirrors the record picked in the 3D room).
withDefaults(defineProps<{ search?: boolean /* false: the page has its own search bar */ }>(), { search: true })
useSpotify()
checkLogin()
loadGroups()
const route = useRoute()
const msg = ref<Flash | null>(null)
if (route.query.spotify === 'ok') msg.value = { ok: 'Spotify er koblet til.' }
if (route.query.spotify === 'feil') msg.value = { error: 'Klarte ikke å koble til Spotify. Prøv igjen.' }

const q = ref('')
const spot = ref(false) // searching all of Spotify (albums + songs) instead of just the shelf
const sq = ref('')
const rootEl = ref<HTMLElement | null>(null)
// in the room, the shelf search also pulls the matching records out of the shelf – and the camera goes there
watch(q, (v) => {
  room.shelfQ = v
  if (v.trim() && mode.value === 'rom' && !room.sel.musikk) { room.musicView = 'vinyl'; room.shelfView = true }
})
onBeforeUnmount(() => { room.shelfQ = '' })

const selectedUri = computed(() => (room.sel.musikk?.kind === 'album' ? room.sel.musikk.uri : null))
const album = computed(() => findAlbum(selectedUri.value))
const items = computed((): GridItem[] => {
  const n = q.value.trim().toLowerCase()
  const list = n ? spotify.albums.filter((a) => `${a.name} ${a.artist}`.toLowerCase().includes(n)) : spotify.albums
  return sorted('album', list).map((a) => ({ uri: a.uri, name: a.name, sub: a.artist, image: a.image || a.thumb }))
})

function pick(it: GridItem) {
  room.sel.musikk = { kind: 'album', uri: it.uri, t: Date.now() }
}
function back() {
  room.sel.musikk = null
}

// jump to the top when a record opens or closes
watch(selectedUri, async () => {
  await nextTick()
  const body = rootEl.value?.closest('.panel-body')
  if (body) body.scrollTo({ top: 0, behavior: 'smooth' })
  else if (rootEl.value && rootEl.value.getBoundingClientRect().top < 0) rootEl.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

</script>

<template>
  <div ref="rootEl" class="vp">
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>

    <div v-if="spotify.loaded && !spotify.connected" class="empty">
      <template v-if="!spotify.configured">Spotify er ikke satt opp ennå.</template>
      <template v-else-if="admin.mine">
        <p>Koble til Spotify-kontoen din for å fylle albumene dine.</p>
        <a class="btn primary" href="api.php?action=spotify_login">Koble til Spotify</a>
      </template>
      <template v-else>Musikken er ikke koblet til ennå.</template>
    </div>

    <template v-if="spotify.connected">
      <transition name="fade" mode="out-in">
        <MusicDetail v-if="album" :key="album.uri" :item="album" kind="album" back-label="Alle album" :compact="mode === 'rom'" @back="back" />

        <div v-else class="browse">
          <div v-if="spot" class="head">
            <input v-model="sq" type="search" class="search wide" placeholder="Søk album og låter på Spotify …" aria-label="Søk på Spotify" autofocus />
            <button class="spot on" aria-label="Lukk" title="Lukk" @click="spot = false; sq = ''"><CloseIcon :size="14" /></button>
          </div>
          <SpotifySearch v-if="spot" :q="sq" scope="player" />
          <template v-else>
            <div class="stick">
            <div class="head">
              <b>Album</b>
              <span v-if="search" class="tools">
                <input v-model="q" type="search" class="search" placeholder="Søk i albumene …" aria-label="Søk i albumene" />
                <button v-if="admin.mine" class="spot" title="Søk i hele Spotify" @click="spot = true"><SearchIcon :size="14" />Spotify</button>
              </span>
            </div>
            <GroupBar artist />
            </div>
            <GroupedGrid by-artist :flat="!!q.trim()" :items="items" :playing-uri="spotify.now?.context" @pick="pick" @hover="(it) => prefetchTracks(it.uri)" />
            <p v-if="!items.length" class="muted">Ingen treff.</p>
          </template>
        </div>
      </transition>
    </template>
  </div>
</template>

<style scoped>
.stick { min-width: 0; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px 16px; }
.stick .head { flex: 0 0 auto; margin: 0 2px; padding-bottom: 6px; }
.stick :deep(.gb) { flex: 1 1 280px; min-width: 0; max-width: 100%; }
.stick :deep(.gb .gbrow) { justify-content: flex-end; }
.stick .head b { font-size: 1.05rem; letter-spacing: 0.04em; color: var(--text-2); }
.vp { container-type: inline-size; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.browse { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.muted { color: var(--text-3); font-size: 0.85rem; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 2px 2px 0; }
.head b { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.search { width: 160px; min-width: 0; flex: 0 1 160px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 500 0.82rem var(--font); outline: none; }
.search:focus { border-color: var(--accent); }
.tools { display: flex; align-items: center; gap: 6px; }
.search.wide { width: auto; flex: 1 1 auto; }
.spot { display: inline-flex; align-items: center; gap: 4px; padding: 6px 11px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text-2); font: 600 0.78rem var(--font); cursor: pointer; flex: none; }
.spot:hover, .spot.on { color: var(--accent); border-color: var(--accent); }
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
