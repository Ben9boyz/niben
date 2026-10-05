<script setup>
import { computed } from 'vue'
import { spotify } from '../composables/useSpotify'
import { sorted } from '../composables/useSort'
import { room } from '../composables/useRoom'
import CoverGrid from './CoverGrid.vue'
import SortButton from './SortButton.vue'

// "Alt": the playlists and the albums together in one view (each in its own section, in the chosen order).
const lists = computed(() => sorted('playlist', spotify.playlists).map((p) => ({ uri: p.uri, name: p.name, sub: p.count ? `${p.count} låter` : p.owner, image: p.image || p.thumb })))
const albums = computed(() => sorted('album', spotify.albums).map((a) => ({ uri: a.uri, name: a.name, sub: a.artist, image: a.image || a.thumb })))
function openList(it) {
  room.musicView = 'ipod'
  room.ipod.playlist = spotify.playlists.find((p) => p.uri === it.uri)
  room.ipod.view = 'playlist'
  room.ipod.active = 0
}
function openAlbum(it) {
  room.musicView = 'vinyl'
  room.sel.musikk = { kind: 'album', uri: it.uri, t: Date.now() }
}
</script>

<template>
  <div class="all">
    <section v-if="lists.length">
      <header><b class="label-caps">Spillelister <span>{{ lists.length }}</span></b><SortButton kind="playlist" /></header>
      <CoverGrid :items="lists" :playing-uri="spotify.now?.context" @pick="openList" />
    </section>
    <section v-if="albums.length">
      <header><b class="label-caps">Album <span>{{ albums.length }}</span></b><SortButton kind="album" /></header>
      <CoverGrid :items="albums" :playing-uri="spotify.now?.context" @pick="openAlbum" />
    </section>
  </div>
</template>

<style scoped>
.all { display: grid; gap: 22px; min-width: 0; }
section { display: grid; gap: 10px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header span { margin-left: 6px; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.7rem; letter-spacing: 0; }
</style>
