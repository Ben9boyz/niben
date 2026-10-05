<script setup>
import { computed, watch } from 'vue'
import { spotify } from '../composables/useSpotify'
import { mode } from '../composables/useMode'
import { room } from '../composables/useRoom'
import { peek, peekClear } from '../composables/useBrowse'
import PeekView from '../components/PeekView.vue'
import NowPlaying from '../components/NowPlaying.vue'
import VinylPanel from '../components/VinylPanel.vue'
import PlaylistPanel from '../components/PlaylistPanel.vue'

// picking a record or playlist in the room closes any album / artist page opened with "Gå til …"
watch(() => [room.sel.musikk, room.ipod.playlist, room.musicView], () => { if (peek.stack.length) peekClear() })
// phones in the 3D room: no empty "Ingenting spilles" card – the record player is the stage
const phone = window.matchMedia('(max-width: 720px)').matches
const showNow = computed(() => !(phone && mode.value === 'rom' && !spotify.now?.name))
</script>

<template>
  <section class="panel glass music-panel">
    <div class="panel-body">
      <div v-if="showNow" class="np-sticky"><NowPlaying /></div>
      <transition name="fade" mode="out-in">
        <PeekView v-if="peek.stack.length" key="peek" />
        <PlaylistPanel v-else-if="room.musicView.startsWith('ipod')" key="p" />
        <VinylPanel v-else key="v" />
      </transition>
    </div>
  </section>
</template>

<style scoped>
.music-panel .panel-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  padding-top: 0;
  /* whatever scrolls up past the "now playing" card fades out instead of being cut off */
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 16px);
  mask-image: linear-gradient(to bottom, transparent 0, #000 16px);
}
/* "now playing" (progress + volume) stays put while records and playlists scroll underneath */
.np-sticky { position: sticky; top: 0; z-index: 4; padding-top: 16px; } /* starts where it sticks: no jump */
.np-sticky :deep(.now) {
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  box-shadow: inset 0 1px 0 var(--glass-hi), 0 8px 24px rgba(0, 0, 0, 0.12);
}
</style>
