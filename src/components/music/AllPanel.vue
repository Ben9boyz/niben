<script setup lang="ts">
import { computed } from 'vue'
import { spotify } from '@/composables/music/useSpotify'
import { sort, sorted } from '@/composables/music/useSort'
import { room } from '@/composables/room/useRoom'
import GroupedGrid from './GroupedGrid.vue'
import GroupBar from './GroupBar.vue'
import { admin } from '@/composables/site/useAdmin'
import { showMenu } from '@/composables/useContextMenu'
import { targetEl } from '@/lib/dom'
import type { GridItem } from '@/types'
import { playlistsMenu, promptNewPlaylist } from '@/lib/menus'
import { Plus } from 'lucide-vue-next'
function emptyMenu(e: MouseEvent) { if (!admin.mine || e.defaultPrevented || targetEl(e).closest('.cell, input, button, a')) return; showMenu(e, 'Spillelister', playlistsMenu()) }

// "Alt": the albums and the playlists together in ONE pot – one grid, my folders / lists work across both
// (but no "Artist" view). The sort button picks A–Å, or albums / playlists first.
const lists = computed((): GridItem[] => sorted('playlist', spotify.playlists).map((p) => ({ uri: p.uri, name: p.name, sub: p.count ? `${p.count} låter` : p.owner, image: p.image || p.thumb })))
const albums = computed((): GridItem[] => sorted('album', spotify.albums).map((a) => ({ uri: a.uri, name: a.name, sub: a.artist, image: a.image || a.thumb })))
const nb = (a: string | null | undefined, b: string | null | undefined) => String(a || '').localeCompare(String(b || ''), 'nb')
const items = computed(() => {
  if (sort.all === 'albums') return [...albums.value, ...lists.value]
  if (sort.all === 'lists') return [...lists.value, ...albums.value]
  return [...albums.value, ...lists.value].sort((a, b) => nb(a.name, b.name))
})
function open(it: GridItem) {
  if (it.uri.startsWith('spotify:playlist:')) {
    room.musicView = 'ipod'
    room.ipod.playlist = spotify.playlists.find((p) => p.uri === it.uri) ?? null
    room.ipod.view = 'playlist'
    room.ipod.active = 0
  } else {
    room.musicView = 'vinyl'
    room.sel.musikk = { kind: 'album', uri: it.uri, t: Date.now() }
  }
}
</script>

<template>
  <div class="all" @contextmenu="emptyMenu">
    <button v-if="admin.mine" class="newpl" aria-label="Ny spilleliste" @click="promptNewPlaylist"><Plus :size="15" />Ny spilleliste</button>
    <GroupBar all />
    <GroupedGrid :items="items" :playing-uri="spotify.now?.context" @pick="open" />
    <p v-if="!items.length" class="muted">Ingenting her ennå.</p>
  </div>
</template>

<style scoped>
.all { display: grid; gap: 14px; min-width: 0; }
.muted { color: var(--text-3); }
.newpl { justify-self: start; display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 14px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-2); font: 600 0.82rem var(--font); cursor: pointer; touch-action: manipulation; }
.newpl:hover { color: var(--accent); border-color: var(--accent); }
</style>
