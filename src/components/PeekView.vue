<script setup>
import { computed } from 'vue'
import MusicDetail from './MusicDetail.vue'
import ArtistPage from './ArtistPage.vue'
import { peek, peekBack } from '../composables/useBrowse'
import { mode } from '../composables/useMode'

// The "Gå til album / artist" pages, shared by the flat music page and the 3D room's side panel: the top of the browse
// stack, with "Tilbake" going to the one before it (and finally to the shelf / playlists you came from).
const top = computed(() => peek.stack[peek.stack.length - 1] || null)
const backLabel = computed(() => (peek.stack.length > 1 ? 'Tilbake' : 'Tilbake'))
</script>

<template>
  <template v-if="top">
    <MusicDetail v-if="top.kind === 'album'" :key="top.item.uri" :item="top.item" kind="album" :back-label="backLabel" :compact="mode === 'rom'" @back="peekBack" />
    <ArtistPage v-else :key="top.item.id || top.item.name" :artist="top.item" :back-label="backLabel" @back="peekBack" />
  </template>
</template>
