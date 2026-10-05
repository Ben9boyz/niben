<script setup>
import { computed } from 'vue'
import { spotify } from '../composables/useSpotify'
import { sort, sorted } from '../composables/useSort'
import { room } from '../composables/useRoom'
import GroupedGrid from './GroupedGrid.vue'
import GroupBar from './GroupBar.vue'
import { admin } from '../composables/useAdmin'
import { showMenu } from '../composables/useContextMenu'
import { playlistsMenu } from '../lib/menus'
function emptyMenu(e) { if (!admin.loggedIn || e.defaultPrevented || e.target.closest?.('.cell, input, button, a')) return; showMenu(e, 'Spillelister', playlistsMenu()) }

// "Alt": the albums and the playlists together in ONE pot – one grid, my folders / lists work across both
// (but no "Artist" view). The sort button picks A–Å, or albums / playlists first.
const lists = computed(() => sorted('playlist', spotify.playlists).map((p) => ({ uri: p.uri, name: p.name, sub: p.count ? `${p.count} låter` : p.owner, image: p.image || p.thumb })))
const albums = computed(() => sorted('album', spotify.albums).map((a) => ({ uri: a.uri, name: a.name, sub: a.artist, image: a.image || a.thumb })))
const nb = (a, b) => String(a || '').localeCompare(String(b || ''), 'nb')
const items = computed(() => {
  if (sort.all === 'albums') return [...albums.value, ...lists.value]
  if (sort.all === 'lists') return [...lists.value, ...albums.value]
  return [...albums.value, ...lists.value].sort((a, b) => nb(a.name, b.name))
})
function open(it) {
  if (it.uri.startsWith('spotify:playlist:')) {
    room.musicView = 'ipod'
    room.ipod.playlist = spotify.playlists.find((p) => p.uri === it.uri)
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
    <GroupBar all />
    <GroupedGrid :items="items" :playing-uri="spotify.now?.context" @pick="open" />
    <p v-if="!items.length" class="muted">Ingenting her ennå.</p>
  </div>
</template>

<style scoped>
.all { display: grid; gap: 14px; min-width: 0; }
.muted { color: var(--text-3); }
</style>
