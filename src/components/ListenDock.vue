<script setup>
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, ArrowUpFromLine, Library, ScanEye, Smartphone, SkipBack, SkipForward, Play, Pause, RotateCw, X, Lock, Undo2 } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { shelfAlbums } from '../composables/useGroups'
import { spotify, lockLeft, play, control, findAlbum, fmtClock } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// Phones, the 3D listening corner: ONE small bar at the bottom with exactly what you can do where you are – no
// side menus. At the turntable: down to the shelf · look from above · the iPod. From above: the buttons (back / play /
// next). In front of the shelf: up to the turntable · the records one by one · take out. With a record in hand: put it
// back · turn it over · play. Big, thumb-sized buttons that stay inside the safe area (nothing hides under the browser's bars).
const busy = ref(false)
const toast = ref('')
const say = (t) => { toast.value = t; setTimeout(() => (toast.value = ''), 2600) }

const held = computed(() => (room.sel.musikk?.kind === 'album' ? findAlbum(room.sel.musikk.uri) : null))
const shelfCount = computed(() => Math.min(shelfAlbums.value.length, 150))
const peeked = computed(() => (room.shelfView && !room.sel.musikk ? shelfAlbums.value[room.peekIndex] : null))
const ipodHeld = computed(() => room.musicView === 'ipod')
const state = computed(() => (held.value ? 'held' : room.shelfView ? 'shelf' : ipodHeld.value ? 'ipod' : room.deckView ? 'deck' : 'base'))

const locked = computed(() => lockLeft.value > 0)
const isOn = computed(() => !!held.value && spotify.now?.context === held.value.uri && !!spotify.now?.name)
const blocked = computed(() => !isOn.value && locked.value)
const playing = computed(() => !!spotify.now?.playing)

// ── navigating ──
const toShelf = () => { room.deckView = false; room.musicView = 'vinyl'; room.sel.musikk = null; room.shelfView = true }
const toTurntable = () => { room.sel.musikk = null; room.shelfView = false; room.deckView = false; if (room.musicView === 'ipod') room.musicView = 'ipodDock' }
const toDeck = () => { room.shelfView = false; room.sel.musikk = null; room.musicView = 'vinyl'; room.deckView = true }
const toIpod = () => { room.deckView = false; room.shelfView = false; room.sel.musikk = null; room.musicView = 'ipod' }
const putIpodDown = () => { room.musicView = 'ipodDock' }
const putBack = () => { room.sel.musikk = null; room.recordFlipped = false }
const flip = () => { room.recordFlipped = !room.recordFlipped }
function browse(d) {
  const n = shelfCount.value
  if (n) room.peekIndex = (room.peekIndex + d + n) % n
}
function takeOut() {
  if (peeked.value) room.sel.musikk = { kind: 'album', uri: peeked.value.uri, t: Date.now() }
}

// ── playing ──
async function playHeld() {
  if (!held.value || busy.value || !admin.loggedIn) return
  busy.value = true
  const r = isOn.value ? await control(playing.value ? 'pause' : 'resume') : await play(held.value.uri)
  busy.value = false
  if (!r.ok) say(r.error)
}
async function ctl(op) {
  if (!admin.loggedIn || busy.value) return
  busy.value = true
  const r = await control(op)
  busy.value = false
  if (!r.ok) say(r.error)
}
const toggle = () => ctl(playing.value ? 'pause' : 'resume')
</script>

<template>
  <div class="ld" role="toolbar" aria-label="Lytteplassen">
    <transition name="tt"><div v-if="toast" class="toast glass">{{ toast }}</div></transition>
    <div class="bar glass">
      <!-- a record in hand -->
      <template v-if="state === 'held'">
        <button class="b" aria-label="Legg tilbake" @click="putBack"><X :size="20" /><span>Legg tilbake</span></button>
        <button class="b" :aria-label="room.recordFlipped ? 'Forside' : 'Se låtene'" @click="flip"><RotateCw :size="20" /><span>{{ room.recordFlipped ? 'Forside' : 'Låter' }}</span></button>
        <button v-if="admin.loggedIn" class="b go" :disabled="busy || blocked" :aria-label="isOn && playing ? 'Pause' : 'Spill av'" @click="playHeld">
          <Lock v-if="blocked" :size="20" /><Pause v-else-if="isOn && playing" :size="20" fill="currentColor" /><Play v-else :size="20" fill="currentColor" />
          <span>{{ blocked ? fmtClock(lockLeft) : isOn && playing ? 'Pause' : 'Spill' }}</span>
        </button>
      </template>

      <!-- in front of the shelf: browse -->
      <template v-else-if="state === 'shelf'">
        <button class="b compact" aria-label="Opp til platespilleren" @click="toTurntable"><Undo2 :size="20" /><span>Opp</span></button>
        <button class="b arrow" aria-label="Forrige album" @click="browse(-1)"><ChevronLeft :size="26" /></button>
        <div class="pk"><b>{{ peeked?.name || 'Hylla' }}</b><small v-if="peeked">{{ room.peekIndex + 1 }}/{{ shelfCount }}</small></div>
        <button class="b arrow" aria-label="Neste album" @click="browse(1)"><ChevronRight :size="26" /></button>
        <button class="b go compact" :disabled="!peeked" aria-label="Ta ut platen" @click="takeOut"><ArrowUpFromLine :size="20" /><span>Ta ut</span></button>
      </template>

      <!-- the iPod in hand -->
      <template v-else-if="state === 'ipod'">
        <button class="b" aria-label="Legg fra deg iPoden" @click="putIpodDown"><Undo2 :size="20" /><span>Legg fra deg</span></button>
        <button class="b" aria-label="Til platene" @click="toShelf"><Library :size="20" /><span>Hylla</span></button>
      </template>

      <!-- from above: the turntable's buttons -->
      <template v-else-if="state === 'deck'">
        <button class="b" aria-label="Tilbake" @click="toTurntable"><Undo2 :size="20" /><span>Tilbake</span></button>
        <template v-if="admin.loggedIn">
          <button class="b arrow" aria-label="Forrige låt" :disabled="busy" @click="ctl('previous')"><SkipBack :size="22" fill="currentColor" /></button>
          <button class="b go round" :aria-label="playing ? 'Pause' : 'Spill'" :disabled="busy" @click="toggle"><Pause v-if="playing" :size="24" fill="currentColor" /><Play v-else :size="24" fill="currentColor" /></button>
          <button class="b arrow" aria-label="Neste låt" :disabled="busy" @click="ctl('next')"><SkipForward :size="22" fill="currentColor" /></button>
        </template>
        <button class="b" aria-label="Ned til hylla" @click="toShelf"><Library :size="20" /><span>Hylla</span></button>
      </template>

      <!-- at the turntable -->
      <template v-else>
        <button class="b" aria-label="Ned til hylla" @click="toShelf"><Library :size="20" /><span>Hylla</span></button>
        <button class="b" aria-label="Se platespilleren ovenfra" @click="toDeck"><ScanEye :size="20" /><span>Ovenfra</span></button>
        <button class="b" aria-label="Ta iPoden" @click="toIpod"><Smartphone :size="20" /><span>iPod</span></button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ld { position: fixed; z-index: 36; left: 0; right: 0; bottom: calc(10px + env(safe-area-inset-bottom)); display: grid; justify-items: center; gap: 8px; padding: 0 10px; pointer-events: none; }
.ld > * { pointer-events: auto; }
.bar { display: flex; align-items: center; justify-content: center; gap: 2px; max-width: 100%; box-sizing: border-box; overflow: hidden; padding: 5px; border-radius: 999px; }
.b { flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 46px; height: 46px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--text); font: 600 0.8rem var(--font); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.b:active:not(:disabled) { background: var(--accent-soft); color: var(--accent); }
.b:disabled { opacity: 0.4; }
.b span { white-space: nowrap; }
.b.compact { padding: 0 11px; gap: 4px; }
.b.arrow { padding: 0; width: 42px; background: var(--accent-soft); color: var(--accent); }
.b.go { background: var(--accent); color: #fff; }
.b.go:disabled { background: var(--glass-border); color: var(--text-3); }
.b.round { width: 52px; height: 52px; padding: 0; }
.pk { display: grid; justify-items: center; min-width: 0; width: clamp(64px, 22vw, 110px); padding: 0 2px; text-align: center; line-height: 1.15; }
.pk b { max-width: 100%; font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pk small { font-size: 0.66rem; color: var(--text-3); }
.toast { padding: 8px 14px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; max-width: calc(100vw - 32px); text-align: center; }
.tt-enter-active, .tt-leave-active { transition: opacity 0.2s, transform 0.2s; }
.tt-enter-from, .tt-leave-to { opacity: 0; transform: translateY(6px); }
@media (max-width: 360px) { .b span { display: none; } .b { padding: 0 12px; } }
</style>
