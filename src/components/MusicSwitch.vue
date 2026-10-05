<script setup>
import { computed } from 'vue'
import { room } from '../composables/useRoom'
import { spotify } from '../composables/useSpotify'
import SegSwitch from './SegSwitch.vue'

// The listening corner in the room: records (the shelf / turntable) or playlists (the iPod).
const DISC = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'
const IPOD = 'M8.5 2.5h7a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5a2.5 2.5 0 0 1 2.5-2.5zM9 5h6v5.5H9zM12 18.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'
const items = computed(() => [
  { id: 'vinyl', label: 'Album', icon: DISC, count: spotify.albums.length || '' },
  { id: 'ipod', label: 'Spillelister', icon: IPOD, count: spotify.playlists.length || '' },
])
const view = computed({
  get: () => (room.musicView.startsWith('ipod') ? 'ipod' : 'vinyl'),
  set: (v) => {
    if (v === 'ipod') { room.musicView = 'ipodDock'; room.sel.musikk = null } else room.musicView = 'vinyl'
  },
})
</script>

<template>
  <SegSwitch v-model="view" :items="items" floating label="Musikk" />
</template>
