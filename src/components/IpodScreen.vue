<script setup lang="ts">
import { ChevronLeft, ChevronRight, Play, Lock, Shuffle, Folder, X } from 'lucide-vue-next'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { room } from '../composables/useRoom'
import { ipodRows, ipodFolderName, type IpodRow } from '../composables/useIpodList'
import { groups, openFolder } from '../composables/useGroups'
import { spotify, useSpotify, lockLeft, progressMs, fmtClock, play, fetchTracks, lockNote, control, setShuffle } from '../composables/useSpotify'
import { admin, checkLogin } from '../composables/useAdmin'
import { targetEl } from '../lib/dom'
import type { Track, TrackList, Playlist } from '../types'

// HTML screen laid over the 3D iPod while it's held in front of the camera.
useSpotify()
checkLogin()

const rect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
// shared with the panel (room.ipod) so the iPod and the panel mirror each other
const view = computed({ get: () => room.ipod.view, set: (v: typeof room.ipod.view) => (room.ipod.view = v) })
const playlist = computed({ get: () => room.ipod.playlist, set: (v: Playlist | null) => (room.ipod.playlist = v) })
const active = computed({ get: () => room.ipod.active, set: (v: number) => (room.ipod.active = v) })
const tracks = ref<TrackList | null>(null)
watch(playlist, async (p) => {
  tracks.value = null
  if (p) tracks.value = await fetchTracks(p.uri)
}, { immediate: true })
const listEl = ref<HTMLElement | null>(null)
const toast = ref('')
let raf = 0

const locked = computed(() => lockLeft.value > 0)
const now = computed(() => spotify.now)
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value?.duration_ms) * 100 : 0))

// rows for the current view, so arrow keys / click wheel work the same everywhere
type Row = IpodRow | { kind: 'playall'; label: string } | { kind: 'track'; label: string; sub?: string; item: Track; ms?: number; img?: string | null }
const itemUri = (r: Row): string => ('item' in r ? r.item.uri : r.label)
const imgOf = (r: Row): string | null | undefined => ('img' in r ? r.img : null)
const rows = computed<Row[]>(() => {
  if (view.value === 'menu') {
    // the same list and order as the panel (folders first when grouping is on) so the highlight can be shared
    return ipodRows.value
  }
  if (view.value === 'playlist') {
    const r: Row[] = []
    if (admin.mine) {
      const here = now.value?.context === playlist.value?.uri
      r.push({ kind: 'playall', label: here ? (now.value?.playing ? 'Pause' : 'Spill videre') : locked.value ? `Låst ${fmtClock(lockLeft.value)}` : 'Spill av lista' })
    }
    for (const t of tracks.value?.tracks || []) r.push({ kind: 'track', label: t.name, sub: t.artist, item: t, ms: t.ms, img: t.img })
    return r
  }
  return []
})

watch(() => [room.ipod.q, groups.sel], () => { if (view.value === 'menu') active.value = 0 })
const title = computed(() => (view.value === 'menu' ? (!room.ipod.q.trim() && ipodFolderName.value) || 'Spillelister' : view.value === 'now' ? 'Spilles nå' : playlist.value?.name || ''))

function frame() {
  raf = requestAnimationFrame(frame)
  const r = room.api?.ipodScreenRect()
  rect.value = r && r.w > 40 ? r : null
}

async function open(row: Row | undefined) {
  if (!row) return
  if (row.kind === 'folder') { openFolder(row.id); active.value = 0; return }
  if (row.kind === 'playlist') {
    playlist.value = row.item
    view.value = 'playlist'
    active.value = 0
    return
  }
  if (row.kind === 'playall' || row.kind === 'track') {
    if (!admin.mine) return
    // what's already playing can be paused / resumed even while locked
    const pl = playlist.value
    if (!pl) return
    const current = row.kind === 'track' ? now.value?.uri === row.item.uri : now.value?.context === pl.uri
    if (current) { wheel('toggle'); return }
    if (locked.value) { toast.value = `Låst – hør ferdig (${fmtClock(lockLeft.value)})`; setTimeout(() => (toast.value = ''), 2600); return }
    toast.value = 'Starter …'
    const r = await play(pl.uri, row.kind === 'track' ? row.item.uri : null)
    toast.value = r.ok ? `Spiller${lockNote()}` : r.error ?? ''
    setTimeout(() => (toast.value = ''), 2600)
    if (r.ok) setTimeout(() => (view.value = 'now'), 900)
  }
}

// the click wheel: shuffle (top), previous / next track, play / pause (bottom)
async function wheel(op: 'shuffle' | 'toggle' | 'previous' | 'next') {
  if (!admin.mine) { toast.value = 'Logg inn for å styre musikken'; setTimeout(() => (toast.value = ''), 2200); return }
  const r = op === 'shuffle'
    ? await setShuffle(!spotify.now?.shuffle)
    : await control(op === 'toggle' ? (spotify.now?.playing ? 'pause' : 'resume') : op)
  toast.value = !r.ok ? r.error ?? '' : op === 'shuffle' ? (spotify.now?.shuffle ? 'Shuffle på' : 'Shuffle av') : ''
  if (toast.value) setTimeout(() => (toast.value = ''), 2200)
}

function back() {
  if (view.value === 'menu') {
    // inside a folder: up one level (to its parent folder, or the top); at the top: put the iPod down
    if (groups.on && groups.sel && !room.ipod.q.trim()) { const par = groups.list.find((g) => g.id === groups.sel)?.parent; groups.sel = par || null; active.value = 0 }
    else room.musicView = 'ipodDock'
  } else { view.value = 'menu'; active.value = 0 }
}

function move(d: number) {
  const n = rows.value.length
  if (!n) return
  active.value = (active.value + d + n) % n
  nextTick(() => listEl.value?.querySelector('.row.on')?.scrollIntoView({ block: 'nearest' }))
}

function onKey(e: KeyboardEvent) {
  if (targetEl(e).tagName === 'INPUT') return
  if (e.key === 'ArrowDown') { move(1); e.preventDefault() }
  else if (e.key === 'ArrowUp') { move(-1); e.preventDefault() }
  else if (e.key === 'Enter' || e.key === 'ArrowRight') { open(rows.value[active.value]); e.preventDefault() }
  else if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'Backspace') { back(); e.preventDefault() }
}

onMounted(() => {
  raf = requestAnimationFrame(frame)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="rect" class="ipod" :style="{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`, '--u': `${rect.h / 100}px` }">
    <header>
      <button class="back" @click="back" :aria-label="view === 'menu' ? 'Legg fra deg iPoden' : 'Tilbake'"><ChevronLeft width="1em" height="1em" /></button>
      <span><Shuffle v-if="now?.shuffle" width="0.75em" height="0.75em" class="shf" />{{ title }}</span>
      <span class="rt">
        <button class="np" :class="{ on: now?.playing }" @click="view = 'now'" aria-label="Spilles nå"><Play width="1em" height="1em" fill="currentColor" /></button>
        <button class="np px" @click="room.musicView = 'ipodDock'" aria-label="Legg fra deg iPoden" title="Legg fra deg iPoden"><X width="1em" height="1em" /></button>
      </span>
    </header>

    <div v-if="view === 'now'" class="nowview">
      <img crossorigin="anonymous" v-if="now?.image" :src="now.image" alt="" />
      <div class="nm">
        <b>{{ now?.name || 'Ingenting spilles' }}</b>
        <span>{{ now?.artist }}</span>
        <span class="alb">{{ now?.album }}</span>
      </div>
      <div v-if="now?.duration_ms" class="prog">
        <div class="bar"><span :style="{ width: `${pct}%` }"></span></div>
        <div class="times"><span>{{ fmtClock(progressMs / 1000) }}</span><span>-{{ fmtClock(Math.max(0, now.duration_ms - progressMs) / 1000) }}</span></div>
      </div>
      <div v-if="locked" class="lockline"><Lock width="0.9em" height="0.9em" /> Låst i {{ fmtClock(lockLeft) }}</div>
    </div>

    <div v-else ref="listEl" class="list">
      <input v-if="view === 'menu'" v-model="room.ipod.q" type="search" class="isearch" placeholder="Søk" aria-label="Søk i spillelistene" @keydown.stop />
      <div v-if="view === 'playlist' && !tracks" class="msg">Henter låter …</div>
      <div v-else-if="view === 'playlist' && tracks?.hidden" class="msg">Spotify viser bare låtene i spillelister du har laget selv.</div>
      <button
        v-for="(r, i) in rows"
        :key="r.kind + itemUri(r) + i"
        class="row"
        :class="{ on: i === active, dim: (r.kind === 'playall' && locked && now?.context !== playlist?.uri) || (r.kind === 'track' && (!admin.mine || (locked && now?.uri !== r.item.uri))) }"
        @click="active = i; open(r)"
        @mouseenter="active = i"
      >
        <img v-if="imgOf(r)" crossorigin="anonymous" :src="imgOf(r) || undefined" alt="" class="art" loading="lazy" />
        <span class="l"><Play v-if="r.kind === 'playall' && !locked" width="0.8em" height="0.8em" fill="currentColor" class="pa" /><Folder v-if="r.kind === 'folder'" width="0.85em" height="0.85em" class="pa" />{{ r.label }}</span>
        <span v-if="r.kind === 'track' && r.ms" class="r">{{ fmtClock((r.ms ?? 0) / 1000) }}</span>
        <span v-else-if="r.kind === 'playlist' || r.kind === 'folder'" class="r"><ChevronRight width="1em" height="1em" /></span>
      </button>
      <div v-if="view === 'menu' && !rows.length" class="msg">{{ room.ipod.q ? 'Ingen treff.' : 'Ingen spillelister.' }}</div>
    </div>

    <transition name="fade"><div v-if="toast" class="toast">{{ toast }}</div></transition>
  </div>

  <!-- the 3D click wheel: shuffle (top), ⏮ / ⏭ previous / next track, ⏯ play / pause, centre = choose -->
  <div v-if="rect" class="wheel" :style="{ left: `${rect.x + rect.w / 2}px`, top: `${rect.y + rect.h * 1.9}px`, width: `${rect.h * 1.574}px`, height: `${rect.h * 1.574}px` }">
    <button class="w-menu" :aria-label="spotify.now?.shuffle ? 'Shuffle av' : 'Shuffle på'" title="Shuffle" @click="wheel('shuffle')"></button>
    <button class="w-prev" aria-label="Forrige låt" title="Forrige låt" @click="wheel('previous')"></button>
    <button class="w-next" aria-label="Neste låt" title="Neste låt" @click="wheel('next')"></button>
    <button class="w-play" :aria-label="spotify.now?.playing ? 'Pause' : 'Spill'" :title="spotify.now?.playing ? 'Pause' : 'Spill'" @click="wheel('toggle')"></button>
    <button class="w-center" aria-label="Velg" @click="open(rows[active])"></button>
  </div>

</template>

<style scoped>
.ipod {
  position: fixed;
  z-index: 25;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: calc(var(--u) * 2.5);
  background: linear-gradient(180deg, #f4f7fb, #e3e9f0);
  color: #111;
  font-family: -apple-system, 'Helvetica Neue', Inter, sans-serif;
  font-size: calc(var(--u) * 6.4);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
  animation: on 0.35s ease both;
}
@keyframes on { from { filter: brightness(0.2); } }
header {
  display: grid;
  grid-template-columns: calc(var(--u) * 16) minmax(0, 1fr) calc(var(--u) * 24);
  padding: 0 calc(var(--u) * 1.5);
  align-items: center;
  height: calc(var(--u) * 13);
  flex: none;
  background: linear-gradient(180deg, #fefefe, #ccd4dd);
  border-bottom: 1px solid #a9b3bf;
  font-weight: 700;
  text-align: center;
}
header span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np { display: grid; place-items: center; border: 0; background: none; cursor: pointer; color: #9aa; font-size: 0.8em; padding: 0; height: 100%; }
.np.on { color: #1db954; }
.rt { display: grid; grid-template-columns: 1fr 1fr; height: 100%; }
.np.px:hover { color: #d24b4b; }
.back {
  display: grid;
  place-items: center;
  height: calc(var(--u) * 9);
  border: 0;
  border-radius: calc(var(--u) * 2);
  background: rgba(43, 127, 240, 0.12);
  color: #2b7ff0;
  font-size: 1.5em;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  padding: 0 0 calc(var(--u) * 0.8);
}
.back:hover { background: rgba(43, 127, 240, 0.22); }
.list { flex: 1; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
.list::-webkit-scrollbar { display: none; }
.isearch { display: block; width: calc(100% - var(--u) * 6); margin: calc(var(--u) * 1.5) calc(var(--u) * 3); padding: calc(var(--u) * 1.2) calc(var(--u) * 3); border: 0; border-radius: 999px; background: rgba(0, 0, 0, 0.08); box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18); font: inherit; font-size: 0.8em; outline: none; color: #111; }
.row {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  width: 100%;
  min-height: calc(var(--u) * 12.5);
  padding: 0 calc(var(--u) * 3.5);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.row.on { background: linear-gradient(180deg, #6cbcff, #2b7ff0); color: #fff; }
.row.dim { opacity: 0.55; }
.art { width: calc(var(--u) * 9); height: calc(var(--u) * 9); flex: none; border-radius: calc(var(--u) * 1); object-fit: cover; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
.l { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pa { margin-right: 0.35em; vertical-align: -0.05em; }
.r { display: flex; align-items: center; opacity: 0.7; font-variant-numeric: tabular-nums; }
.msg { padding: calc(var(--u) * 5); color: #556; font-size: 0.85em; text-align: center; }
.nowview { flex: 1; display: grid; grid-template-columns: 42% 1fr; grid-template-rows: 1fr auto auto; gap: calc(var(--u) * 3); padding: calc(var(--u) * 4); }
.nowview img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: calc(var(--u)); box-shadow: 0 4px 10px rgba(0,0,0,.25); align-self: center; }
.nm { display: flex; flex-direction: column; justify-content: center; min-width: 0; gap: calc(var(--u)); }
.nm b { font-size: 1.05em; line-height: 1.15; }
.nm span { font-size: 0.85em; color: #445; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nm .alb { color: #778; }
.prog { grid-column: 1 / -1; }
.bar { height: calc(var(--u) * 2.2); border-radius: 99px; background: #cfd6de; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,.2); }
.bar span { display: block; height: 100%; background: linear-gradient(180deg, #6cbcff, #2b7ff0); transition: width 1s linear; }
.times { display: flex; justify-content: space-between; font-size: 0.75em; color: #556; margin-top: calc(var(--u)); font-variant-numeric: tabular-nums; }
.lockline { grid-column: 1 / -1; text-align: center; font-size: 0.8em; color: #b8711a; font-weight: 600; }
.toast { position: absolute; left: 8%; right: 8%; bottom: 8%; padding: calc(var(--u) * 2.5); border-radius: calc(var(--u) * 2); background: rgba(20, 28, 40, 0.88); color: #fff; font-size: 0.8em; text-align: center; }
.wheel { position: fixed; z-index: 25; transform: translate(-50%, -50%); border-radius: 50%; }
.wheel button { position: absolute; border: 0; padding: 0; background: transparent; cursor: pointer; border-radius: 50%; transition: background 0.15s; }
.wheel button:hover { background: rgba(43, 127, 240, 0.12); }
.wheel button:active { background: rgba(43, 127, 240, 0.25); }
.w-menu { left: 32%; right: 32%; top: 2%; height: 30%; }
.w-play { left: 32%; right: 32%; bottom: 2%; height: 30%; }
.w-prev { top: 32%; bottom: 32%; left: 2%; width: 30%; }
.w-next { top: 32%; bottom: 32%; right: 2%; width: 30%; }
.w-center { left: 36%; top: 36%; width: 28%; height: 28%; }
.putdown {
  position: fixed;
  z-index: 25;
  transform: translateX(-50%);
  padding: 9px 18px;
  border: 0;
  border-radius: 999px;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.putdown:hover { color: var(--accent); }
.shf { margin-right: 0.3em; vertical-align: -0.05em; color: #2b7ff0; }
</style>
