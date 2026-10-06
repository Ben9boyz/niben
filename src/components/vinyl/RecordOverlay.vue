<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Play, Pause, Lock, RotateCw, X, ChevronLeft, ChevronRight, ArrowUpFromLine } from 'lucide-vue-next'
import { room } from '@/composables/room/useRoom'
import { shelfAlbums } from '@/composables/music/useGroups'
import { spotify, lockLeft, fmtClock, play, lockNote, control, fetchTracks, findAlbum } from '@/composables/music/useSpotify'
import { admin } from '@/composables/site/useAdmin'
import { targetEl } from '@/lib/dom'
import type { Track, TrackList } from '@/types'

// Sits on the record held up in the 3D room: a play button in its corner, its name underneath, a button
// to turn it over – the back shows the track list (scrolls if it's long) – and one to put it back.
// In front of the shelf there's a way back up to the turntable.
const rect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const busy = ref(false)
const toast = ref('')
let raf = 0

const album = computed(() => (room.sel.musikk?.kind === 'album' ? findAlbum(room.sel.musikk.uri) : null))
const locked = computed(() => lockLeft.value > 0)
const playingThis = computed(() => spotify.now?.context === album.value?.uri)

function frame() {
  raf = requestAnimationFrame(frame)
  const r = album.value ? room.api?.recordScreenRect() : null
  const next = r && r.w > 60 ? r : null
  // only touch reactive state when it moved
  const cur = rect.value
  if (!next !== !cur || (next && cur && (Math.abs(next.x - cur.x) > 0.5 || Math.abs(next.y - cur.y) > 0.5 || Math.abs(next.w - cur.w) > 0.5))) rect.value = next
}

// this record is the one on: the button pauses / resumes (always allowed, even while locked)
const isOn = computed(() => playingThis.value && !!spotify.now?.name)
const blocked = computed(() => !isOn.value && locked.value)

async function onPlay() {
  if (!album.value || busy.value) return
  if (isOn.value) {
    busy.value = true
    const r = await control(spotify.now?.playing ? 'pause' : 'resume')
    busy.value = false
    if (!r.ok) { toast.value = r.error ?? ''; setTimeout(() => (toast.value = ''), 3000) }
    return
  }
  if (locked.value) return
  busy.value = true
  const r = await play(album.value.uri)
  busy.value = false
  toast.value = r.ok ? `Spiller «${album.value.name}»${lockNote()}` : r.error ?? ''
  setTimeout(() => (toast.value = ''), 3000)
}

// ── the back of the sleeve: the track list, shown once the record has turned ──
const tracks = ref<TrackList | null>(null)
const backReady = ref(false)
let flipTimer: ReturnType<typeof setTimeout> | undefined
watch(() => room.recordFlipped, (on) => {
  clearTimeout(flipTimer)
  backReady.value = false
  if (on) flipTimer = setTimeout(() => (backReady.value = true), 420)
})
watch(album, async (a) => {
  tracks.value = null
  if (a) tracks.value = await fetchTracks(a.uri)
}, { immediate: true })
async function playTrack(t: Track) {
  const a = album.value
  if (!a || !admin.mine || busy.value) return
  if (isOn.value && spotify.now?.uri === t.uri) return onPlay() // already on: pause / resume
  if (locked.value) { toast.value = `Låst – hør ferdig (${fmtClock(lockLeft.value)})`; setTimeout(() => (toast.value = ''), 3000); return }
  busy.value = true
  const r = await play(a.uri, t.uri)
  busy.value = false
  toast.value = r.ok ? `Spiller «${t.name}»${lockNote()}` : r.error ?? ''
  setTimeout(() => (toast.value = ''), 3000)
}
const flip = () => (room.recordFlipped = !room.recordFlipped)
const putBack = () => { room.sel.musikk = null }
function toTurntable() { room.sel.musikk = null; room.shelfView = false }

// ── browsing the shelf: one record pulled out at a time, ← / → to move along, Enter to take it ──
const shelfCount = computed(() => Math.min(shelfAlbums.value.length, 150))
const peeked = computed(() => (room.shelfView && !room.sel.musikk ? shelfAlbums.value[room.peekIndex] : null))
function browse(d: number) {
  const n = shelfCount.value
  if (n) room.peekIndex = (room.peekIndex + d + n) % n
}
function takeOut() {
  if (peeked.value) room.sel.musikk = { kind: 'album', uri: peeked.value.uri, t: Date.now() }
}

// Esc: turn back → put the record back → leave the shelf
function onKey(e: KeyboardEvent) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl(e).tagName)) return
  if (peeked.value) {
    if (e.key === 'ArrowLeft') { browse(-1); e.preventDefault(); return }
    if (e.key === 'ArrowRight') { browse(1); e.preventDefault(); return }
    if (e.key === 'Enter' || e.key === 'ArrowUp') { takeOut(); e.preventDefault(); return }
  }
  // the record in my hand: P or Enter puts it on and starts it from the first song
  if (room.sel.musikk && !peeked.value && (e.key === 'Enter' || e.key.toLowerCase() === 'p') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); onPlay(); return }
  if (e.key !== 'Escape') return
  if (room.recordFlipped) room.recordFlipped = false
  else if (room.sel.musikk) putBack()
  else if (room.shelfView) room.shelfView = false
}

// The mouse wheel / trackpad over the 3D view: turned-over record → scrolls its song list · browsing the shelf (or
// holding a record from it) → moves along the shelf, one record per notch
let acc = 0, wheelAt = 0
function onWheel(e: WheelEvent) {
  if (!room.shelfView && !room.sel.musikk) return
  if (targetEl(e).closest('.dock, .rback, .smenu, .gwin, .ctx, .cm, .pk')) return // panels and lists scroll themselves
  if (room.recordFlipped && backReady.value) {
    const tl = document.querySelector<HTMLElement>('.rback .tl')
    if (tl) { tl.scrollBy({ top: e.deltaY }); e.preventDefault() }
    return
  }
  if (!room.shelfView) return
  e.preventDefault()
  acc += e.deltaY
  const now = performance.now()
  if (Math.abs(acc) < 50 || now - wheelAt < 140) return
  const d = acc > 0 ? 1 : -1
  acc = 0
  wheelAt = now
  const n = shelfCount.value
  if (!n) return
  if (peeked.value) browse(d)
  else if (album.value) { // a record in my hand: put it back and take the neighbour
    const cur = album.value.uri
    const i = shelfAlbums.value.findIndex((a) => a.uri === cur)
    const j = ((i < 0 ? room.peekIndex : i) + d + n) % n
    room.peekIndex = j
    const next = shelfAlbums.value[j]
    if (next) room.sel.musikk = { kind: 'album', uri: next.uri, t: Date.now() }
  }
}

onMounted(() => { raf = requestAnimationFrame(frame); window.addEventListener('keydown', onKey); window.addEventListener('wheel', onWheel, { passive: false }) })
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearTimeout(flipTimer); window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel) })
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
            :class="{ current: spotify.now?.uri === t.uri, clickable: admin.mine && (!locked || spotify.now?.uri === t.uri) }"
            @click="playTrack(t)"
          >
            <span class="n">{{ t.n || i + 1 }}</span>
            <span class="t">{{ t.name }}</span>
            <span class="d">{{ fmtClock((t.ms ?? 0) / 1000) }}</span>
          </li>
        </ol>
      </div>
    </transition>

    <button class="rflip glass" :style="{ left: `${rect.x + 16}px`, top: `${rect.y + rect.h - 16}px` }" :title="room.recordFlipped ? 'Snu tilbake' : 'Snu platen – se låtene'" @click="flip">
      <RotateCw :size="17" /><span>{{ room.recordFlipped ? 'Forside' : 'Låter' }}</span>
    </button>
    <!-- lock length, tucked into the top-left corner (rarely changed) -->
    <button class="rclose glass" :style="{ left: `${rect.x + rect.w - 14}px`, top: `${rect.y + 14}px` }" title="Legg tilbake i hylla (Esc)" aria-label="Legg tilbake" @click="putBack">
      <X :size="16" />
    </button>

    <button
      v-if="admin.mine"
      class="rplay"
      :class="{ locked: blocked }"
      :disabled="blocked || busy"
      :style="{ left: `${rect.x + rect.w - 18}px`, top: `${rect.y + rect.h - 18}px` }"
      :title="blocked ? `Låst ${fmtClock(lockLeft)}` : isOn ? (spotify.now?.playing ? 'Pause' : 'Fortsett') : `Spill av «${album.name}»`"
      :aria-label="blocked ? 'Låst' : isOn && spotify.now?.playing ? 'Pause' : 'Spill av'"
      @click="onPlay"
    >
      <Lock v-if="blocked" :size="22" />
      <Pause v-else-if="isOn && spotify.now?.playing" :size="24" fill="currentColor" />
      <Play v-else :size="24" fill="currentColor" />
    </button>
    <div class="rcap glass" :style="{ left: `${rect.x + rect.w / 2}px`, top: `${rect.y + rect.h + 14}px`, maxWidth: `${Math.max(rect.w, 260)}px` }">
      <b>{{ album.name }}</b>
      <span>{{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template><template v-if="isOn"> · <em :class="{ paused: !spotify.now?.playing }">{{ spotify.now?.playing ? 'spilles nå' : 'på pause' }}</em></template></span>
    </div>
    <transition name="fade">
      <div v-if="toast" class="rtoast glass" :style="{ left: `${rect.x + rect.w / 2}px`, top: `${rect.y - 14}px` }">{{ toast }}</div>
    </transition>
  </template>

  <!-- in front of the shelf: browse one record at a time, or go back up to the turntable -->
  <div v-if="room.shelfView" class="shelfbar">
    <button class="toturn glass" @click="toTurntable"><ChevronLeft :size="16" />Til platespilleren</button>
    <div v-if="peeked" class="browser glass">
      <button class="arrow" aria-label="Forrige album (←)" title="Forrige (←)" @click="browse(-1)"><ChevronLeft :size="22" /></button>
      <div class="pk"><b>{{ peeked.name }}</b><small>{{ peeked.artist }}<template v-if="peeked.year"> · {{ peeked.year }}</template> · {{ room.peekIndex + 1 }}/{{ shelfCount }}</small></div>
      <button class="arrow" aria-label="Neste album (→)" title="Neste (→)" @click="browse(1)"><ChevronRight :size="22" /></button>
      <button class="take" title="Ta ut (Enter)" @click="takeOut"><ArrowUpFromLine :size="16" />Ta ut</button>
    </div>
  </div>
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
.tl { flex: 1; margin: 6px 0 0; padding: 0 6px 0 0; list-style: none; overflow-y: auto; overscroll-behavior: contain; }
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
.shelfbar { position: fixed; z-index: 24; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 32px); }
.toturn { display: flex; align-items: center; gap: 4px; padding: 10px 16px; border: 0; border-radius: 999px; color: var(--text); font: 600 0.85rem var(--font); cursor: pointer; white-space: nowrap; }
.toturn:hover { color: var(--accent); }
.browser { display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 999px; min-width: 0; }
.arrow { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--accent-soft); color: var(--accent); cursor: pointer; }
.arrow:hover { background: var(--accent); color: #fff; }
.pk { display: flex; flex-direction: column; align-items: center; min-width: 160px; max-width: 300px; padding: 0 6px; text-align: center; }
.pk b { font-size: 0.9rem; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pk small { font-size: 0.72rem; color: var(--text-3); white-space: nowrap; }
.take { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--accent); color: #fff; font: 700 0.85rem var(--font); cursor: pointer; }
.take:hover { filter: brightness(1.08); }
.rtoast { position: fixed; z-index: 26; transform: translate(-50%, -100%); padding: 8px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 600; white-space: nowrap; }
</style>
