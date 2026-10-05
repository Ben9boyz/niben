<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ListMusic, Music, ChevronRight } from 'lucide-vue-next'
import { spotify, fetchQueue, fetchTracks, fmtClock } from '../composables/useSpotify'
import { queueDrop, queueOver, drag } from '../composables/useDrag'

// Under "now playing": what comes next, and – for an album – where you are in it ("Låt 5 av 12"). For an album
// the queue is simply the rest of the album, so there is nothing to skip to; for a playlist it shows what's coming.
const queue = ref(null)
const pos = ref(null) // { n, of } while an album plays
let timer = 0
const props = defineProps({ flat: Boolean, collapsible: Boolean }) // playlists: always the plain song list · collapsible: the list can be folded away (3D panel, mini player)
const KEY = 'niben-queue-open'
const shut = ref(props.collapsible && (() => { try { return localStorage.getItem(KEY) === '0' } catch { return false } })())
function toggleShut() { if (!props.collapsible) return; shut.value = !shut.value; try { localStorage.setItem(KEY, shut.value ? '0' : '1') } catch {} }
const open = ref(new Set()) // album groups that are unfolded
let soon = 0

// the queue as albums: songs that directly follow each other on the same album become one tile (never songs picked from here and there) ("Resten av …" for the
// album that's playing, then each album I queued). Tap a tile to see its songs. Only when there is an album to show.
const groups = computed(() => {
  const out = []
  for (const t of queue.value || []) {
    const last = out[out.length - 1]
    // only songs that follow each other: same album, right after one another in the queue AND in the album's order
    const prev = last?.tracks[last.tracks.length - 1]
    const inOrder = !prev || prev.no == null || t.no == null || (t.disc === prev.disc ? t.no === prev.no + 1 : t.no === 1)
    if (last && t.album_uri && last.uri === t.album_uri && inOrder) last.tracks.push(t)
    else out.push({ uri: t.album_uri, name: t.album || t.name, image: t.album_image || t.img, tracks: [t] })
  }
  return out
})
// songs right after each other from the same album are an album; a single song is from a playlist
const asAlbums = computed(() => !props.flat && groups.value.length > 0)
const isAlbum = (g) => g.tracks.length > 1
const minutes = (g) => {
  const m = Math.round(g.tracks.reduce((a, t) => a + (t.ms || 0), 0) / 60000)
  return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`
}
const rest = (g, i) => i === 0 && g.uri && g.uri === spotify.now?.context
function toggle(i) { const o = new Set(open.value); o.has(i) ? o.delete(i) : o.add(i); open.value = o }
watch(() => spotify.now?.uri, () => { open.value = new Set() })
async function load() { queue.value = await fetchQueue() }
async function where() {
  const ctx = spotify.now?.context
  if (!ctx?.startsWith('spotify:album:')) { pos.value = null; return }
  const list = (await fetchTracks(ctx)).tracks || []
  const i = list.findIndex((t) => t.uri === spotify.now?.uri)
  pos.value = i >= 0 ? { n: i + 1, of: list.length } : null
}
// a new song: look again (a moment later, once Spotify has caught up)
watch(() => spotify.now?.uri, () => { clearTimeout(soon); soon = setTimeout(() => { load(); where() }, 700) }, { immediate: true })
onMounted(() => { timer = setInterval(() => { if (!document.hidden && spotify.now?.playing) load() }, 15000) })
onBeforeUnmount(() => { clearInterval(timer); clearTimeout(soon) })
</script>

<template>
  <section v-if="spotify.now?.name" class="qp" :class="{ over: queueOver, armed: drag.track || drag.item }" v-on="queueDrop">
    <header :class="{ tap: collapsible }" :role="collapsible ? 'button' : null" :tabindex="collapsible ? 0 : null" :aria-expanded="collapsible ? !shut : null" @click="toggleShut" @keydown.enter="toggleShut">
      <b class="label-caps"><ListMusic :size="13" aria-hidden="true" />Neste i køen<small v-if="collapsible && queue?.length" class="cnt">{{ queue.length }}</small></b>
      <small v-if="pos" class="pos">Låt {{ pos.n }} av {{ pos.of }}</small>
      <ChevronRight v-if="collapsible" :size="15" class="fold" :class="{ open: !shut }" aria-hidden="true" />
    </header>
    <p v-if="queueOver" class="drophint">Slipp for å legge sist i køen</p>
    <template v-if="!shut">
    <p v-if="!queue" class="muted">Henter …</p>
    <p v-else-if="!queue.length" class="muted">Ingenting mer i køen.</p>
    <ol v-else-if="asAlbums" class="albums">
      <li v-for="(g, i) in groups.slice(0, 14)" :key="(g.uri || g.name) + i" class="grp" :class="{ one: !isAlbum(g) }">
        <button v-if="isAlbum(g)" class="gh" :aria-expanded="open.has(i)" @click="toggle(i)">
          <img v-if="g.image" crossorigin="anonymous" :src="g.image" alt="" /><span v-else class="ph"><Music :size="13" /></span>
          <span class="t" translate="no"><b>{{ rest(g, i) ? 'Resten av ' + g.name : g.name }}</b><small><i class="tag">Album</i>{{ g.tracks.length }} låter · {{ minutes(g) }}</small></span>
          <ChevronRight :size="15" class="chev" :class="{ on: open.has(i) }" aria-hidden="true" />
        </button>
        <div v-else class="gh single">
          <img v-if="g.tracks[0].img || g.image" crossorigin="anonymous" :src="g.tracks[0].img || g.image" alt="" /><span v-else class="ph"><Music :size="13" /></span>
          <span class="t" translate="no"><b>{{ g.tracks[0].name }}</b><small><i class="tag pl">Spilleliste</i>{{ g.tracks[0].artist }}</small></span>
          <small class="d">{{ fmtClock(g.tracks[0].ms / 1000) }}</small>
        </div>
        <ol v-if="isAlbum(g) && open.has(i)" class="songs">
          <li v-for="(t, j) in g.tracks" :key="t.uri + j"><span class="n">{{ j + 1 }}</span><span class="t" translate="no"><b>{{ t.name }}</b></span><small class="d">{{ fmtClock(t.ms / 1000) }}</small></li>
        </ol>
      </li>
    </ol>
    <ol v-else>
      <li v-for="(t, i) in queue.slice(0, 12)" :key="t.uri + i">
        <img v-if="t.img" crossorigin="anonymous" :src="t.img" alt="" /><span v-else class="ph"><Music :size="13" /></span>
        <span class="t" translate="no"><b>{{ t.name }}</b><small>{{ t.artist }}</small></span>
        <small class="d">{{ fmtClock(t.ms / 1000) }}</small>
      </li>
    </ol>
    </template>
  </section>
</template>

<style scoped>
.qp { display: grid; gap: 8px; padding: 12px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
.qp.armed { border-style: dashed; border-color: #1db954; }
.qp.over { background: color-mix(in srgb, #1db954 14%, var(--glass-strong)); }
.drophint { margin: 0; padding: 8px; border-radius: 10px; text-align: center; font-weight: 700; font-size: 0.82rem; color: #1db954; background: color-mix(in srgb, #1db954 12%, transparent); }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header.tap { cursor: pointer; border-radius: 10px; margin: -4px -6px; padding: 4px 6px; }
header.tap:hover { background: var(--accent-soft); }
.cnt { margin-left: 4px; padding: 0 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.68rem; letter-spacing: 0; }
.fold { margin-left: auto; color: var(--text-3); transition: transform 0.2s; }
.fold.open { transform: rotate(90deg); }
header b { display: inline-flex; align-items: center; gap: 6px; }
.pos { padding: 2px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: 700 0.7rem var(--font); }
.muted { margin: 0; color: var(--text-3); font-size: 0.82rem; }
ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; max-height: 340px; overflow-y: auto; overscroll-behavior: contain; }
li { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 9px; padding: 3px 4px; border-radius: 8px; }
li img, .ph { width: 32px; height: 32px; border-radius: 5px; object-fit: cover; background: var(--accent-soft); }
.ph { display: grid; place-items: center; color: var(--text-3); }
.t { display: grid; min-width: 0; }
.t b { font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t small, .d { font-size: 0.72rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d { font-variant-numeric: tabular-nums; }
.albums { max-height: 420px; }
.tag { margin-right: 6px; padding: 0 6px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-style: normal; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.tag.pl { background: color-mix(in srgb, #1db954 16%, transparent); color: #1a8f46; }
.gh.single { cursor: default; }
.gh.single:hover { background: transparent; }
.grp { display: block; padding: 0; }
.gh { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; width: 100%; padding: 4px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: left; cursor: pointer; font: inherit; }
.gh:hover { background: var(--accent-soft); }
.gh img, .gh .ph { width: 40px; height: 40px; border-radius: 6px; }
.chev { color: var(--text-3); transition: transform 0.2s; }
.chev.on { transform: rotate(90deg); }
.songs { display: grid; gap: 1px; margin: 2px 0 6px 50px; padding: 0; max-height: none; overflow: visible; }
.songs li { grid-template-columns: 18px minmax(0, 1fr) auto; padding: 3px 4px; }
.n { font-size: 0.7rem; color: var(--text-3); text-align: right; font-variant-numeric: tabular-nums; }
</style>
