<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { Disc3, ListMusic, Sparkles } from 'lucide-vue-next'
import { room } from '@/composables/room/useRoom'
import { spotify } from '@/composables/music/useSpotify'

// The three lists of the listening corner, as tabs at the top of the side panel (the PC) and of the full-screen library
// (phones): Album (the records) · Spillelister (the iPod) · Oppdag (my picks and suggestions). A tab only decides what the
// panel shows – except Album, which also takes the camera down to the record shelf, and Spillelister, which takes it to the iPod.
const tab = computed(() => (room.discover ? 'discover' : room.listTab))
const pc = window.matchMedia('(min-width: 901px)')
function pick(t: 'vinyl' | 'ipod' | 'discover') {
  if (t === 'discover') { room.discover = true; room.sel.musikk = null; return }
  room.discover = false
  room.listTab = t
  // Spillelister takes the camera to the iPod (the panel stays where it is). Album takes the camera down to the record shelf (on a PC; on a phone the sheet is what you look at)
  if (t === 'ipod' && pc.matches) {
    room.deckView = false; room.shelfView = false; room.sel.musikk = null; room.ipod.playlist = null; room.ipod.view = 'menu'
    room.musicView = 'ipod'
    void nextTick(() => { room.panelHidden = false }) // (the iPod otherwise slides the panel away – here the panel is what was just used)
  }
  if (t === 'vinyl' && pc.matches) { room.musicView = 'vinyl'; room.sel.musikk = null; room.deckView = false; room.shelfView = true }
}
</script>

<template>
  <nav class="mtabs" role="tablist" aria-label="Musikk">
    <button role="tab" :aria-selected="tab === 'vinyl'" :class="{ on: tab === 'vinyl' }" @click="pick('vinyl')"><Disc3 :size="15" aria-hidden="true" /><span>Album</span><small>{{ spotify.albums.length || '' }}</small></button>
    <button role="tab" :aria-selected="tab === 'ipod'" :class="{ on: tab === 'ipod' }" @click="pick('ipod')"><ListMusic :size="15" aria-hidden="true" /><span>Spillelister</span><small>{{ spotify.playlists.length || '' }}</small></button>
    <button role="tab" :aria-selected="tab === 'discover'" :class="{ on: tab === 'discover' }" @click="pick('discover')"><Sparkles :size="15" aria-hidden="true" /><span>Oppdag</span></button>
  </nav>
</template>

<style scoped>
.mtabs { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--glass); border: 1px solid var(--glass-border); width: max-content; max-width: 100%; }
.mtabs button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.82rem var(--font); cursor: pointer; white-space: nowrap; transition: background 0.2s, color 0.2s; }
.mtabs button:hover { color: var(--text); }
.mtabs button.on { background: var(--glass-strong); color: var(--accent); box-shadow: inset 0 1px 0 var(--glass-hi); }
.mtabs small { opacity: 0.6; font-weight: 500; }
@media (max-width: 720px) { .mtabs { width: 100%; } .mtabs button { flex: 1; justify-content: center; padding: 10px 8px; } }
</style>
