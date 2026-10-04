<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Play, Pause, Lock, RotateCw, X, ChevronLeft } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { spotify, lockLeft, fmtClock, play, lockNote, control, fetchTracks } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// Sits on the record held up in the 3D room: a play button in its corner, its name underneath, a button
// to turn it over – the back shows the track list (scrolls if it's long) – and one to put it back.
// In front of the shelf there's a way back up to the turntable.
const rect = ref(null)
const busy = ref(false)
const toast = ref('')
let raf = 0

const album = computed(() => (room.sel.musikk?.kind === 'album' ? spotify.albums.find((a) => a.uri === room.sel.musikk.uri) : null))
const locked = computed(() => lockLeft.value > 0)
const playingThis = computed(() => spotify.now?.context === album.value?.uri)

function frame() {
  raf = requestAnimationFrame(frame)
  const r = album.value ? room.api?.recordScreenRect() : null
  const next = r && r.w > 60 ? r : null
  // only touch reactive state when it moved
  if (!next !== !rect.value || (next && (Math.abs(next.x - rect.value.x) > 0.5 || Math.abs(next.y - rect.value.y) > 0.5 || Math.abs(next.w - rect.value.w) > 0.5))) rect.value = next
}

// this record is the one on: the button pauses / resumes (always allowed, even while locked)
const isOn = computed(() => playingThis.value && !!spotify.now?.name)
const blocked = computed(() => !isOn.value && locked.value)

async function onPlay() {
  if (!album.value || busy.value) return
  if (isOn.value) {
    busy.value = true
    const r = await control(spotify.now.playing ? 'pause' : 'resume')
    busy.value = false
    if (!r.ok) { toast.value = r.error; setTimeout(() => (toast.value = ''), 3000) }
    return
  }
  if (locked.value) return
  busy.value = true
  const r = await play(album.value.uri)
  busy.value = false
  toast.value = r.ok ? `Spiller «${album.value.name}»${lockNote()}` : r.error
  setTimeout(() => (toast.value = ''), 3000)
}

// ── the back of the sleeve: the track list, shown once the record has turned ──
const tracks = ref(null)
const backReady = ref(false)
let flipTimer = 0
watch(() => room.recordFlipped, (on) => {
  clearTimeout(flipTimer)
  backReady.value = false
  if (on) flipTimer = setTimeout(() => (backReady.value = true), 420)
})
watch(album, async (a) => {
  tracks.value = null
  if (a) tracks.value = await fetchTracks(a.uri)
}, { immediate: true })
async function playTrack(t) {
  if (!admin.loggedIn || locked.value || busy.value) return
  busy.value = true
  const r = await play(album.value.uri, t.uri)
  busy.value = false
  toast.value = r.ok ? `Spiller «${t.name}»${lockNote()}` : r.error
  setTimeout(() => (toast.value = ''), 3000)
}
const flip = () => (room.recordFlipped = !room.recordFlipped)
const putBack = () => { room.sel.musikk = null }
function toTurntable() { room.sel.musikk = null; room.shelfView = false }

// Esc: turn back → put the record back → leave the shelf
function onKey(e) {
  if (e.key !== 'Escape' || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (room.recordFlipped) room.recordFlipped = false
  else if (room.sel.musikk) putBack()
  else if (room.shelfView) room.shelfView = false
}

onMounted(() => { raf = requestAnimationFrame(frame); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearTimeout(flipTimer); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <template v-if="rect && album">
    <!-- back of the sleeve: track list -->
    <transition name="fade">
      <div v-if="room.recordFlipped && backReady" class="rback" :style="{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }">
        <header><b>{{ album.name }}</b><small>{{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template></small></header>
        <ol class="tl">
          <li v-if="!tracks" class="muted">Henter låter …</li>
          <li
            v-for="(t, i) in tracks?.tracks || []"
            :key="t.uri"
            :class="{ current: spotify.now?.uri === t.uri, clickable: admin.loggedIn && !locked }"
            @click="playTrack(t)"
          >
            <span class="n">{{ t.n || i + 1 }}</span>
            <span class="t">{{ t.name }}</span>
            <span class="d">{{ fmtClock(t.ms / 1000) }}</span>
          </li>
        </ol>
      </div>
    </transition>

    <button class="rflip glass" :style="{ left: `${rect.x + 16}px`, top: `${rect.y + rect.h - 16}px` }" :title="room.recordFlipped ? 'Snu tilbake' : 'Snu platen – se låtene'" @click="flip">
      <RotateCw :size="17" /><span>{{ room.recordFlipped ? 'Forside' : 'Låter' }}</span>
    </button>
    <button class="rclose glass" :style="{ left: `${rect.x + rect.w - 14}px`, top: `${rect.y + 14}px` }" title="Legg tilbake i hylla (Esc)" aria-label="Legg tilbake" @click="putBack">
      <X :size="16" />
    </button>

    <button
      v-if="admin.loggedIn"
      class="rplay"
      :class="{ locked: blocked }"
      :disabled="blocked || busy"
      :style="{ left: `${rect.x + rect.w - 18}px`, top: `${rect.y + rect.h - 18}px` }"
      :title="blocked ? `Låst ${fmtClock(lockLeft)}` : isOn ? (spotify.now.playing ? 'Pause' : 'Fortsett') : `Spill av «${album.name}»`"
      :aria-label="blocked ? 'Låst' : isOn && spotify.now.playing ? 'Pause' : 'Spill av'"
      @click="onPlay"
    >
      <Lock v-if="blocked" :size="22" />
      <Pause v-else-if="isOn && spotify.now.playing" :size="24" fill="currentColor" />
      <Play v-else :size="24" fill="currentColor" />
    </button>
    <div class="rcap glass" :style="{ left: `${rect.x + rect.w / 2}px`, top: `${rect.y + rect.h + 14}px`, maxWidth: `${Math.max(rect.w, 260)}px` }">
      <b>{{ album.name }}</b>
      <span>{{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template><template v-if="isOn"> · <em :class="{ paused: !spotify.now.playing }">{{ spotify.now.playing ? 'spilles nå' : 'på pause' }}</em></template></span>
    </div>
    <transition name="fade">
      <div v-if="toast" class="rtoast glass" :style="{ left: `${rect.x + rect.w / 2}px`, top: `${rect.y - 14}px` }">{{ toast }}</div>
    </transition>
  </template>

  <!-- in front of the shelf: back up to the turntable -->
  <button v-if="room.shelfView" class="shelf-back glass" @click="toTurntable"><ChevronLeft :size="16" />Til platespilleren</button>
</template>

<style scoped>
.rplay {
  position: fixed;
  z-index: 24;
  width: 64px;
  height: 64px;
  transform: translate(-100%, -100%);
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #1db954;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(29, 185, 84, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: transform 0.18s var(--spring, ease), filter 0.18s;
  animation: pop 0.4s var(--spring, ease) both;
}
.rplay:hover:not(:disabled) { transform: translate(-100%, -100%) scale(1.08); filter: brightness(1.08); }
.rplay.locked, .rplay:disabled { background: #9aa3ad; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25); cursor: not-allowed; }
@keyframes pop { from { opacity: 0; transform: translate(-100%, -100%) scale(0.6); } }
.rcap {
  position: fixed;
  z-index: 24;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: 16px;
  text-align: center;
  pointer-events: none;
}
.rcap b { font-size: 0.98rem; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.rcap span { font-size: 0.8rem; color: var(--text-2); }
.rcap em { font-style: normal; color: #1db954; font-weight: 600; }
.rcap em.paused { color: var(--text-3); }
.rback {
  position: fixed;
  z-index: 23;
  display: flex;
  flex-direction: column;
  padding: 14px 14px 52px;
  border-radius: 4px;
  background: linear-gradient(160deg, #f7f3ea, #e9e2d3);
  color: #1d1d1f;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.rback header { display: flex; flex-direction: column; padding: 2px 4px 8px; border-bottom: 1px solid rgba(0, 0, 0, 0.12); }
.rback header b { font-size: 0.95rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rback header small { font-size: 0.72rem; color: #6b6458; }
.tl { flex: 1; margin: 6px 0 0; padding: 0 2px 0 0; list-style: none; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.tl li { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 6px; align-items: center; padding: 5px 4px; border-radius: 6px; font-size: 0.8rem; }
.tl li.clickable { cursor: pointer; }
.tl li.clickable:hover { background: rgba(0, 0, 0, 0.06); }
.tl li.current { color: #138a3e; font-weight: 700; }
.tl .n { color: #8b8476; font-variant-numeric: tabular-nums; text-align: right; font-size: 0.72rem; }
.tl .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl .d { color: #8b8476; font-variant-numeric: tabular-nums; font-size: 0.72rem; }
.tl .muted { display: block; color: #8b8476; }
.rflip, .rclose {
  position: fixed;
  z-index: 24;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  color: var(--text);
  cursor: pointer;
  font: 600 0.8rem var(--font);
}
.rflip { height: 38px; padding: 0 14px; border-radius: 999px; transform: translateY(-100%); }
.rclose { width: 32px; height: 32px; justify-content: center; border-radius: 50%; transform: translate(-100%, 0); }
.rflip:hover, .rclose:hover { color: var(--accent); }
.shelf-back { position: fixed; z-index: 24; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 10px 18px; border: 0; border-radius: 999px; color: var(--text); font: 600 0.88rem var(--font); cursor: pointer; }
.shelf-back:hover { color: var(--accent); }
:global(html.player-shell) .shelf-back { bottom: 118px; }
.rtoast { position: fixed; z-index: 26; transform: translate(-50%, -100%); padding: 8px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 600; white-space: nowrap; }
</style>
