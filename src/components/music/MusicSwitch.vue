<script setup lang="ts">
import { computed, watch } from 'vue'
import { Disc3, Library, Smartphone, ScanEye, BookOpen } from 'lucide-vue-next'
import { room } from '@/composables/room/useRoom'
import { spotify } from '@/composables/music/useSpotify'
import { playOn } from '@/composables/music/usePlayOn'

// Where the camera stands in the listening corner. PC: Spiller nå (the table, from a little above and out – the view you
// land in) · Hylle (the records) · iPod · 2D (the plain version), and "Ovenfra" (straight down on the turntable) as a small
// toggle that is only there while a record plays. Phones: a button for the library (full-screen) and 2D; the camera
// buttons are in the bar at the bottom (ListenDock).
const emit = defineEmits(['pick'])
const atIpod = computed(() => room.musicView.startsWith('ipod'))
const atNow = computed(() => !room.shelfView && !room.deckView && !atIpod.value)
const recordPlays = computed(() => playOn.value === 'vinyl' && !!spotify.now?.playing && !!spotify.now?.context?.startsWith('spotify:album:'))
watch(recordPlays, (v) => { if (!v && room.deckView) room.deckView = false })

function goNow() {
  room.discover = false
  room.shelfView = false; room.deckView = false; room.sel.musikk = null
  room.musicView = 'spiller'
}
function goShelf() {
  if (room.shelfView) { goNow(); return }
  room.discover = false
  room.musicView = 'vinyl'; room.sel.musikk = null; room.deckView = false; room.shelfView = true
}
function goIpod() {
  if (atIpod.value) { goNow(); return }
  room.discover = false
  room.deckView = false; room.shelfView = false; room.sel.musikk = null
  room.musicView = 'ipod'
}
function goDeck() {
  if (room.deckView) { room.deckView = false; return }
  room.discover = false
  room.musicView = 'vinyl'; room.sel.musikk = null; room.shelfView = false; room.deckView = true
}
</script>

<template>
  <div class="msw">
    <!-- PC -->
    <nav class="cam glass" role="group" aria-label="Se på …">
      <button :class="{ on: atNow }" :aria-pressed="atNow" @click="goNow"><Disc3 :size="16" aria-hidden="true" /><span>Spiller nå</span></button>
      <button :class="{ on: room.shelfView }" :aria-pressed="room.shelfView" aria-label="Se platehylla" @click="goShelf"><Library :size="16" aria-hidden="true" /><span>Hylle</span></button>
      <button :class="{ on: atIpod }" :aria-pressed="atIpod" aria-label="Gå til iPoden" @click="goIpod"><Smartphone :size="16" aria-hidden="true" /><span>iPod</span></button>
    </nav>
    <transition name="deck">
      <button v-if="recordPlays" class="deck glass" :class="{ on: room.deckView }" :aria-pressed="room.deckView" title="Se platespilleren ovenfra" aria-label="Se platespilleren ovenfra" @click="goDeck"><ScanEye :size="18" aria-hidden="true" /></button>
    </transition>
    <!-- phones -->
    <button class="lib glass" aria-label="Åpne biblioteket" @click="emit('pick')"><BookOpen :size="18" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.msw { position: fixed; z-index: 35; top: 20px; left: calc(var(--rail) + 16px); display: flex; align-items: center; gap: 8px; animation: drop 0.6s var(--spring) both; pointer-events: none; }
.msw > * { pointer-events: auto; }
@keyframes drop { from { opacity: 0; transform: translateY(-14px) scale(0.95); } }
.cam { display: flex; gap: 2px; padding: 5px; border-radius: 999px; }
.cam button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.9rem var(--font); cursor: pointer; white-space: nowrap; transition: background 0.25s, color 0.25s; }
.cam button:hover { color: var(--text); }
.cam button.on { background: var(--glass-strong); color: var(--accent); box-shadow: inset 0 1px 0 var(--glass-hi); }
.deck { display: grid; place-items: center; height: 46px; min-width: 46px; padding: 0 14px; border: 0; border-radius: 999px; color: var(--text-2); font: 700 0.8rem var(--font); cursor: pointer; transition: color 0.2s, transform 0.3s var(--spring); }
.deck:hover { color: var(--accent); transform: scale(1.05); }
.deck { padding: 0; width: 46px; }
.deck.on { color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.deck-enter-active, .deck-leave-active { transition: opacity 0.25s, transform 0.3s var(--spring); }
.deck-enter-from, .deck-leave-to { opacity: 0; transform: scale(0.7); }
.lib { display: none; }
/* phones in the 3D corner: the library button and 2D in the corner – the camera buttons are in the bar at the bottom */
@media (max-width: 900px) {
  html.listen-phone .cam, html.listen-phone .deck { display: none; }
  html.listen-phone .msw { animation: none; }
  html.listen-phone .lib { order: -1; display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 999px; color: var(--text-2); cursor: pointer; touch-action: manipulation; }
}
@media (max-width: 720px) { .msw { top: calc(10px + env(safe-area-inset-top)); left: 108px; } }
</style>
