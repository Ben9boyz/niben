<script setup>
import { room } from '../composables/useRoom'
import NowPlaying from '../components/NowPlaying.vue'
import VinylPanel from '../components/VinylPanel.vue'
import PlaylistPanel from '../components/PlaylistPanel.vue'
</script>

<template>
  <section class="panel glass music-panel">
    <div class="panel-body">
      <div class="np-sticky"><NowPlaying /></div>
      <transition name="fade" mode="out-in">
        <PlaylistPanel v-if="room.musicView.startsWith('ipod')" key="p" />
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
