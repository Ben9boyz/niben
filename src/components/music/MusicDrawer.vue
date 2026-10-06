<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Disc3, ListMusic, X, ArrowUpRight } from 'lucide-vue-next'
import { room } from '@/composables/room/useRoom'
import { spotify } from '@/composables/music/useSpotify'
import NowPlaying from './NowPlaying.vue'
import QueuePanel from './QueuePanel.vue'
import VinylPanel from '@/components/vinyl/VinylPanel.vue'
import PlaylistPanel from './PlaylistPanel.vue'

// The music panel on its own, opened from the mini player: floats over whatever station you're at
// so you can change what's playing without leaving it. A small link goes to the listening corner.
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const ipod = () => room.listTab === 'ipod'

function show(view: 'vinyl' | 'ipod') {
  room.listTab = view
  room.musicView = view
  if (view === 'vinyl') room.sel.musikk = null
  else { room.ipod.playlist = null; room.ipod.view = 'menu' }
}
function toCorner() {
  emit('close')
  router.push('/lytte')
}
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="drawer glass" aria-label="Musikk">
    <header>
      <nav class="tabs pills" role="tablist">
        <button role="tab" :aria-selected="!ipod()" :class="{ on: !ipod() }" @click="show('vinyl')"><Disc3 :size="15" />Album<small>{{ spotify.albums.length || '' }}</small></button>
        <button role="tab" :aria-selected="ipod()" :class="{ on: ipod() }" @click="show('ipod')"><ListMusic :size="15" />Spillelister<small>{{ spotify.playlists.length || '' }}</small></button>
      </nav>
      <button class="corner" title="Gå til lyttehjørnet" @click="toCorner">Lyttehjørnet<ArrowUpRight :size="13" /></button>
      <button class="x" aria-label="Lukk (Esc)" @click="emit('close')"><X :size="16" /></button>
    </header>
    <div class="body">
      <div class="np"><NowPlaying /></div>
      <QueuePanel v-if="spotify.now?.name" collapsible :flat="ipod()" />
      <PlaylistPanel v-if="ipod()" />
      <VinylPanel v-else />
    </div>
  </section>
</template>

<style scoped>
.drawer {
  position: fixed;
  z-index: 23;
  right: 20px;
  bottom: 20px;
  width: min(460px, calc(100vw - 40px));
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow-2, 0 24px 60px rgba(0, 0, 0, 0.35));
}
@keyframes drop { from { opacity: 0; transform: translateY(-10px) scale(0.98); } }
header { display: flex; align-items: center; gap: 6px; padding: 12px 12px 8px; }
.tabs { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--glass); border: 1px solid var(--glass-border); }
.tabs small { opacity: 0.6; font-weight: 500; }
.corner { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; padding: 5px 9px; border: 0; border-radius: 999px; background: transparent; color: var(--text-3); font: 600 0.72rem var(--font); cursor: pointer; }
.corner:hover { color: var(--accent); background: var(--accent-soft); }
.x { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 50%; background: var(--glass); color: var(--text-2); cursor: pointer; }
.x:hover { color: var(--text); }
.body { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 12px; padding: 0 14px 14px; container-type: inline-size; overscroll-behavior: contain; }
.np { position: sticky; top: 0; z-index: 4; }
.np :deep(.now) { background: color-mix(in srgb, var(--bg) 85%, transparent); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
</style>
