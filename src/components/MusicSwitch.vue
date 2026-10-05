<script setup>
import { computed } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { spotify } from '../composables/useSpotify'
import SegSwitch from './SegSwitch.vue'

// The listening corner in the room: records (the shelf / turntable) or playlists (the iPod) – and, as a small icon
// beside the switch, "Oppdag" (my picks and suggestions of albums I don't have).
const DISC = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'
const IPOD = 'M8.5 2.5h7a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5a2.5 2.5 0 0 1 2.5-2.5zM9 5h6v5.5H9zM12 18.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'
const emit = defineEmits(['pick'])
const items = computed(() => [
  { id: 'vinyl', label: 'Album', icon: DISC, count: spotify.albums.length || '' },
  { id: 'ipod', label: 'Spillelister', icon: IPOD, count: spotify.playlists.length || '' },
])
const view = computed({
  get: () => (room.discover ? '' : room.musicView.startsWith('ipod') ? 'ipod' : 'vinyl'),
  set: (v) => {
    emit('pick') // phones: the library sheet slides up
    room.discover = false
    if (v === 'ipod') { room.musicView = 'ipodDock'; room.sel.musikk = null } else room.musicView = 'vinyl'
  },
})
function toggleDiscover() { room.discover = !room.discover; if (room.discover) { room.sel.musikk = null; emit('pick') } }
</script>

<template>
  <div class="msw">
    <SegSwitch v-model="view" :items="items" label="Musikk" />
    <button class="disc glass" :class="{ on: room.discover }" title="Oppdag – album jeg anbefaler" aria-label="Oppdag" :aria-pressed="room.discover" @click="toggleDiscover"><Sparkles :size="18" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.msw { position: fixed; z-index: 35; top: 20px; left: calc(var(--rail) + 16px); display: flex; align-items: center; gap: 8px; animation: drop 0.6s var(--spring) both; pointer-events: none; }
.msw > * { pointer-events: auto; }
@keyframes drop { from { opacity: 0; transform: translateY(-14px) scale(0.95); } }
.disc { display: grid; place-items: center; width: 46px; height: 46px; padding: 0; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; transition: color 0.2s, transform 0.3s var(--spring); }
.disc:hover { color: var(--accent); transform: scale(1.06); }
.disc.on { color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
/* phones: the switch sits in the top bar; Oppdag is the icon inside the library sheet instead */
@media (max-width: 720px) { .msw { top: calc(10px + env(safe-area-inset-top)); left: 62px; } .disc { display: none; } .msw :deep(.seg) { max-width: calc(100vw - 62px - 112px); } .msw :deep(.seg small) { display: none; } }
</style>
