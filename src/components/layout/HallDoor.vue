<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { rooms } from '@/composables/room/useRooms'

// The way out to the hall – not a tab of the room, but a door out of it: the hall is where you go to look for another room.
// So it stands on its own, below the menu: a small door that swings ajar when you come near, with light from the hall behind it.
// In the hall the door stands wide open (and takes you back into the room you came from).
const route = useRoute()
const inHall = computed(() => route.name === 'gangen')
const to = computed(() => (inHall.value ? '/' : '/gangen'))
const shown = computed(() => rooms.total > 1 || inHall.value)
</script>

<template>
  <router-link v-if="shown" :to="to" class="hd glass" :class="{ open: inHall }" :aria-label="inHall ? 'Tilbake inn i rommet' : 'Gangen – finn et annet rom'" :title="inHall ? 'Tilbake inn i rommet' : 'Gangen – finn et annet rom'">
    <span class="frame" aria-hidden="true">
      <span class="light"><Search :size="11" stroke-width="2.6" /></span>
      <span class="leaf"><i class="knob"></i></span>
    </span>
    <span class="lbl">{{ inHall ? 'Tilbake' : 'Gangen' }}</span>
  </router-link>
</template>

<style scoped>
.hd { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex: none; align-self: center; width: 58px; padding: 9px 0 7px; border-radius: 20px; color: var(--text-2); text-decoration: none; transition: color 0.25s, transform 0.4s var(--spring); }
.hd:hover { color: var(--text); transform: translateY(-1px); }
.hd.open { color: var(--accent); }
.frame { position: relative; width: 20px; height: 28px; border: 2px solid currentColor; border-bottom-width: 0; border-radius: 9px 9px 2px 2px; perspective: 120px; }
/* the hall behind the door: warm light, and the magnifying glass – you go there to look */
.light { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 7px 7px 0 0; background: radial-gradient(circle at 50% 70%, color-mix(in srgb, var(--accent) 55%, #ffd27a), color-mix(in srgb, var(--accent) 20%, transparent)); color: #fff; opacity: 0.25; transition: opacity 0.35s; }
.leaf { position: absolute; inset: 0; border-radius: 7px 7px 0 0; background: var(--glass-strong, var(--bg)); border-right: 1px solid color-mix(in srgb, currentColor 30%, transparent); transform-origin: 0 50%; transition: transform 0.55s var(--spring); }
.knob { position: absolute; right: 3px; top: 55%; width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
.hd:hover .leaf, .hd:focus-visible .leaf { transform: rotateY(-58deg); }
.hd:hover .light, .hd:focus-visible .light { opacity: 1; }
.hd.open .leaf { transform: rotateY(-100deg); }
.hd.open .light { opacity: 1; }
.lbl { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.01em; line-height: 1; }
@media (prefers-reduced-motion: reduce) { .leaf { transition: none; } }
@media (min-width: 721px) and (max-height: 700px) { .lbl { display: none; } }
@media (max-width: 720px) {
  html body .hd { position: fixed; z-index: 41; top: calc(10px + env(safe-area-inset-top)); right: 112px; width: 42px; height: 42px; padding: 0; border-radius: 14px; background: transparent; box-shadow: none; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
  html body .hd::before, html body .hd::after { display: none; }
  .lbl { display: none; }
}
</style>
