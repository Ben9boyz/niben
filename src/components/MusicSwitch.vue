<script setup>
import { computed } from 'vue'
import { room } from '../composables/useRoom'
import { spotify } from '../composables/useSpotify'
import SegSwitch from './SegSwitch.vue'

// The listening corner in the room: records (the shelf / turntable) or playlists (the iPod).
const DISC = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'
const IPOD = 'M8.5 2.5h7a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5a2.5 2.5 0 0 1 2.5-2.5zM9 5h6v5.5H9zM12 18.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'
const SPARK = 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'
const phone = window.matchMedia('(max-width: 720px)').matches
const emit = defineEmits(['pick'])
const items = computed(() => [
  { id: 'vinyl', label: 'Album', icon: DISC, count: spotify.albums.length || '' },
  { id: 'ipod', label: 'Spillelister', icon: IPOD, count: spotify.playlists.length || '' },
  ...(phone ? [] : [{ id: 'oppdag', label: 'Oppdag', icon: SPARK, to: { name: 'oppdag' } }]),
])
const view = computed({
  get: () => (room.musicView.startsWith('ipod') ? 'ipod' : 'vinyl'),
  set: (v) => {
    emit('pick') // phones: the library sheet slides up
    if (v === 'ipod') { room.musicView = 'ipodDock'; room.sel.musikk = null } else room.musicView = 'vinyl'
  },
})
</script>

<template>
  <SegSwitch v-model="view" :items="items" floating label="Musikk" />
</template>
