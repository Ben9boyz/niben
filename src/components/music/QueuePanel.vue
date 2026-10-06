<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ListMusic, Music, Play, ChevronRight, Pencil, Check, X, ArrowUp, ArrowDown, GripVertical, Trash2, Shuffle, Lock } from 'lucide-vue-next'
import { spotify, fetchQueue, fetchTracks, fmtClock, skipTo, notify } from '@/composables/music/useSpotify'
import { queueDrop, queueOver, drag } from '@/composables/music/useDrag'
import { admin } from '@/composables/site/useAdmin'
import type { Track, QueueItem } from '@/types'
import { openAlbumPage, openArtistPage, firstArtist } from '@/composables/music/useBrowse'
import { myQueue, loadMyQueue, removeAt, moveRange, clearMine, shuffleMine, locked } from '@/composables/music/useQueue'

// Under "now playing": what comes next. "Min kø" is MY list (admin): drag albums / songs around, move them with the
// arrows, delete, or shuffle – Spotify only gets the next song, a moment before it's needed (see useQueue.js).
// Below it: what Spotify itself plays after that (the rest of the album / playlist), read-only.
const queue = ref<Track[] | null>(null) // Spotify's queue
const pos = ref<{ n: number; of: number; next: string | null } | null>(null) // while an album plays
let timer: ReturnType<typeof setInterval> | undefined
let soon: ReturnType<typeof setTimeout> | undefined
const props = defineProps<{ flat?: boolean; collapsible?: boolean; always?: boolean }>() // playlists: always the plain song list · collapsible: the list can be folded away (3D panel, mini player)
const KEY = 'niben-queue-open'
const shut = ref(props.collapsible && (() => { try { return localStorage.getItem(KEY) !== '1' } catch { return true } })()) // folded away until I open it
function toggleShut() { if (!props.collapsible) return; shut.value = !shut.value; try { localStorage.setItem(KEY, shut.value ? '0' : '1') } catch {} }
const open = ref(new Set<string>()) // groups that are unfolded (by key)
const editing = ref(false)

// songs that directly follow each other on the same album (in the album's order) are one tile
type Song = Track | QueueItem
interface Tile { key: string; uri: string | null | undefined; name: string; image: string | null | undefined; start: number; tracks: { t: Song; idx: number }[] }
function group(list: Song[], flat?: boolean): Tile[] {
  const out: Tile[] = []
  list.forEach((t, idx) => {
    const last = out[out.length - 1]
    const prev = last?.tracks[last.tracks.length - 1]?.t
    const inOrder = !prev || prev.no == null || t.no == null || (t.disc === prev.disc ? t.no === prev.no + 1 : t.no === 1)
    const again = last?.tracks.some((x) => x.t.uri === t.uri)
    if (!flat && last && t.album_uri && last.uri === t.album_uri && inOrder && !again) last.tracks.push({ t, idx })
    else out.push({ key: `${t.uri}#${idx}`, uri: t.album_uri, name: flat ? t.name : t.album || t.name, image: t.album_image || t.img, start: idx, tracks: [{ t, idx }] })
  })
  return out
}
const mine = computed(() => group(myQueue.items, props.flat))
const spotQueue = computed(() => {
  const q = queue.value || []
  const s = myQueue.sent
  const i = s ? q.findIndex((t) => t.uri === s.uri) : -1 // my next song is already in there: it's shown above
  return i >= 0 ? q.filter((_, x) => x !== i) : q
})
const groups = computed(() => group(spotQueue.value, props.flat))
const asAlbums = computed(() => !props.flat && groups.value.length > 0)
const isAlbum = (g: Tile) => g.tracks.length > 1
const single = (g: Tile) => g.tracks.length === 1
const minutes = (g: Tile) => {
  const m = Math.round(g.tracks.reduce((a, x) => a + (x.t.ms || 0), 0) / 60000)
  return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`
}
// Spotify plays what I queued BEFORE the rest of the playing album: the rest is the tile that starts with the song after this one
const rest = (g: Tile) => !!g.uri && g.uri === spotify.now?.context && !!pos.value?.next && g.tracks[0]?.t.uri === pos.value.next
const lockedG = (g: Tile) => g.tracks.some((x) => locked(x.idx))
const mineCount = computed(() => myQueue.items.length)
const totalCount = computed(() => mineCount.value + spotQueue.value.length)
// the name of an album tile opens the album, the artist of a song opens the artist
const openGroupAlbum = (g: Tile) => { const t = g.tracks[0]?.t; if (t && g.uri) openAlbumPage({ uri: g.uri, name: g.name, artist: ('album_artist' in t ? t.album_artist : '') || t.artist || '', image: g.image, image_large: g.image }) }
const openArtistOf = (t?: Song | null) => { if (t?.artist) openArtistPage({ name: firstArtist(t.artist) }) }
function toggle(k: string) { const o = new Set(open.value); o.has(k) ? o.delete(k) : o.add(k); open.value = o }

// ── editing my list ──
function moveGroup(g: Tile, d: number) {
  const gi = mine.value.indexOf(g)
  const n = mine.value[gi + d]
  if (!n || lockedG(g)) return
  moveRange(g.start, g.tracks.length, d < 0 ? n.start : n.start + n.tracks.length - g.tracks.length)
}
function removeGroup(g: Tile) {
  if (lockedG(g)) { for (let i = g.start + g.tracks.length - 1; i > g.start; i--) removeAt(i); return }
  for (let i = g.start + g.tracks.length - 1; i >= g.start; i--) removeAt(i)
}
function moveTrack(idx: number, d: number) { if (!locked(idx) && idx + d >= 0 && idx + d < myQueue.items.length) moveRange(idx, 1, idx + d) }
function clearAll() { if (confirm('Tømme hele køen din?')) clearMine() }
// drag & drop (PC): drop a tile on another to put it there; the arrows do the same on touch screens
const dragging = ref<Tile | null>(null)
const overKey = ref<string | null>(null)
function onDragStart(e: DragEvent, g: Tile) { dragging.value = g; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.key) } }
function onDragOver(e: DragEvent, key: string) { if (!dragging.value) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; overKey.value = key }
function onDrop(e: DragEvent, target: Tile) {
  e.preventDefault()
  const g = dragging.value
  dragging.value = null; overKey.value = null
  if (!g || g === target || lockedG(g)) return
  moveRange(g.start, g.tracks.length, g.start > target.start ? target.start : target.start + target.tracks.length - g.tracks.length)
}
const onDragEnd = () => { dragging.value = null; overKey.value = null }

// a click on a song in Spotify's queue: jump to it (the songs before it are skipped). Only for me – the others just see the queue.
const canHop = computed(() => admin.mine)
async function hop(idx: number, name: string, uri?: string) {
  if (!canHop.value) return
  const r = await skipTo(idx + 1, uri)
  notify(r.ok ? `Spiller «${name}»` : r.error ?? '', !r.ok)
  clearTimeout(soon); soon = setTimeout(load, 900)
}
async function load() { queue.value = await fetchQueue() }
async function where() {
  const ctx = spotify.now?.context
  if (!ctx?.startsWith('spotify:album:')) { pos.value = null; return }
  const list = (await fetchTracks(ctx)).tracks || []
  const i = list.findIndex((t) => t.uri === spotify.now?.uri)
  pos.value = i >= 0 ? { n: i + 1, of: list.length, next: list[i + 1]?.uri || null } : null
}
// a new song: look again (a moment later, once Spotify has caught up)
watch(() => spotify.now?.uri, () => { open.value = new Set(); clearTimeout(soon); soon = setTimeout(() => { void load(); void where() }, 120) }, { immediate: true })
watch(() => spotify.queueV, () => { clearTimeout(soon); soon = setTimeout(load, 40) })
watch(() => admin.mine, (v) => { if (v) loadMyQueue() }, { immediate: true })
onMounted(() => { timer = setInterval(() => { if (!document.hidden && spotify.now?.playing && !editing.value) load() }, 15000) })
onBeforeUnmount(() => { clearInterval(timer); clearTimeout(soon) })
</script>

<template>
  <section v-if="spotify.now?.name || mineCount || always" class="qp" :class="{ over: queueOver, armed: drag.track || drag.item, editing }" v-on="queueDrop">
    <header :class="{ tap: collapsible }" :role="collapsible ? 'button' : undefined" :tabindex="collapsible ? 0 : undefined" :aria-expanded="collapsible ? !shut : undefined" @click="toggleShut" @keydown.enter="toggleShut">
      <b class="label-caps"><ListMusic :size="13" aria-hidden="true" />Neste i køen<small v-if="totalCount" class="cnt">{{ totalCount }}</small></b>
      <small v-if="pos" class="pos">Låt {{ pos.n }} av {{ pos.of }}</small>
      <ChevronRight v-if="collapsible" :size="15" class="fold" :class="{ open: !shut }" aria-hidden="true" />
    </header>
    <p v-if="queueOver" class="drophint">Slipp for å legge sist i køen din</p>
    <template v-if="!shut">
      <div v-if="admin.mine && mineCount" class="bar">
        <button class="edit" :class="{ on: editing }" :aria-pressed="editing" @click="editing = !editing"><Check v-if="editing" :size="13" /><Pencil v-else :size="13" />{{ editing ? 'Ferdig' : 'Rediger' }}</button>
        <button v-if="mineCount > 2" class="edit" title="Bland rekkefølgen i køen din" @click="shuffleMine"><Shuffle :size="13" />Bland</button>
        <button v-if="editing" class="lnk" @click="clearAll"><Trash2 :size="12" />Tøm</button>
      </div>
      <p v-if="editing" class="hint">Dra et album opp eller ned, eller bruk pilene. ✕ tar det bort. Neste låt blir låst like før den spilles.</p>

      <div v-if="mineCount" class="lists">
        <div class="div mine">Min kø</div>
        <div v-for="(g, gi) in mine" :key="g.key" class="grp" :class="{ over: overKey === g.key, dragging: dragging === g }" @dragover="onDragOver($event, g.key)" @drop="onDrop($event, g)">
          <div class="gh">
            <span v-if="editing && !lockedG(g)" class="grip" draggable="true" title="Dra for å flytte" @dragstart="onDragStart($event, g)" @dragend="onDragEnd"><GripVertical :size="15" /></span>
            <div class="open" role="button" tabindex="0" :aria-expanded="open.has(g.key)" @click="toggle(g.key)" @keydown.enter="toggle(g.key)">
              <img v-if="g.image" crossorigin="anonymous" :src="g.image" alt="" /><span v-else class="ph"><Music :size="13" /></span>
              <span class="t" translate="no"><b><a v-if="g.uri && !single(g)" class="lnk" href="#" title="Åpne albumet" @click.stop.prevent="openGroupAlbum(g)">{{ g.name }}</a><template v-else>{{ g.name }}</template><Lock v-if="lockedG(g)" :size="11" class="lk" title="Spotify har den – kan ikke flyttes" /></b><small><a v-if="single(g) && g.tracks[0].t.artist" class="lnk" href="#" title="Åpne artisten" @click.stop.prevent="openArtistOf(g.tracks[0].t)">{{ g.tracks[0].t.artist }}</a><template v-else>{{ single(g) ? '' : `${g.tracks.length} låter` }}</template> · {{ minutes(g) }}</small></span>
              <ChevronRight v-if="!single(g)" :size="15" class="chev" :class="{ on: open.has(g.key) }" aria-hidden="true" />
            </div>
            <span v-if="editing" class="acts">
              <button v-if="!lockedG(g)" aria-label="Flytt opp" title="Opp" :disabled="gi === 0" @click="moveGroup(g, -1)"><ArrowUp :size="14" /></button>
              <button v-if="!lockedG(g)" aria-label="Flytt ned" title="Ned" :disabled="gi === mine.length - 1" @click="moveGroup(g, 1)"><ArrowDown :size="14" /></button>
              <button v-if="!(lockedG(g) && single(g))" class="x" aria-label="Fjern" title="Fjern" @click="removeGroup(g)"><X :size="14" /></button>
            </span>
          </div>
          <ol v-if="open.has(g.key) && !single(g)" class="songs">
            <li v-for="(x, j) in g.tracks" :key="x.t.uri + x.idx">
              <span class="n">{{ x.t.no || j + 1 }}</span>
              <span class="t" translate="no"><b>{{ x.t.name }}</b></span>
              <small class="d">{{ fmtClock((x.t.ms || 0) / 1000) }}</small>
              <span v-if="editing && !locked(x.idx)" class="acts s">
                <button aria-label="Opp" @click="moveTrack(x.idx, -1)"><ArrowUp :size="12" /></button>
                <button aria-label="Ned" @click="moveTrack(x.idx, 1)"><ArrowDown :size="12" /></button>
                <button class="x" aria-label="Fjern" @click="removeAt(x.idx)"><X :size="12" /></button>
              </span>
            </li>
          </ol>
        </div>
      </div>

      <template v-if="spotQueue.length || (!mineCount && queue)">
        <div v-if="mineCount" class="div">Etterpå</div>
        <p v-if="!queue" class="muted">Henter …</p>
        <p v-else-if="!spotQueue.length" class="muted">Ingenting mer i køen.</p>
        <ol v-else-if="asAlbums" class="albums">
          <li v-for="(g, i) in groups.slice(0, 20)" :key="(g.uri || g.name) + i" class="grp" :class="{ one: !isAlbum(g) }">
            <div v-if="isAlbum(g)" class="gh" role="button" tabindex="0" :aria-expanded="open.has('s' + i)" @click="toggle('s' + i)" @keydown.enter="toggle('s' + i)">
              <button v-if="canHop" class="hopb" :title="`Hopp hit: «${g.tracks[0].t.name}»`" :aria-label="`Hopp til ${g.tracks[0].t.name}`" @click.stop="hop(g.tracks[0].idx, g.tracks[0].t.name, g.tracks[0].t.uri)"><img v-if="g.image" crossorigin="anonymous" :src="g.image" alt="" /><span v-else class="ph"><Music :size="13" /></span><Play :size="14" fill="currentColor" class="hopi" /></button>
              <template v-else><img v-if="g.image" crossorigin="anonymous" :src="g.image" alt="" /><span v-else class="ph"><Music :size="13" /></span></template>
              <span class="t" translate="no"><b><template v-if="rest(g)">Resten av </template><a v-if="g.uri" class="lnk" href="#" title="Åpne albumet" @click.stop.prevent="openGroupAlbum(g)">{{ g.name }}</a><template v-else>{{ g.name }}</template></b><small><i class="tag">Album</i>{{ g.tracks.length }} låter · {{ minutes(g) }}</small></span>
              <ChevronRight :size="15" class="chev" :class="{ on: open.has('s' + i) }" aria-hidden="true" />
            </div>
            <div v-else class="gh single" :class="{ hop: canHop }" :role="canHop ? 'button' : undefined" :tabindex="canHop ? 0 : undefined" :title="canHop ? 'Hopp hit' : undefined" @click="hop(g.tracks[0].idx, g.tracks[0].t.name, g.tracks[0].t.uri)" @keydown.enter="hop(g.tracks[0].idx, g.tracks[0].t.name, g.tracks[0].t.uri)">
              <img v-if="g.tracks[0].t.img || g.image" crossorigin="anonymous" :src="g.tracks[0].t.img || g.image || undefined" alt="" /><span v-else class="ph"><Music :size="13" /></span>
              <span class="t" translate="no"><b>{{ g.tracks[0].t.name }}</b><small><a v-if="g.tracks[0].t.artist" class="lnk" href="#" title="Åpne artisten" @click.stop.prevent="openArtistOf(g.tracks[0].t)">{{ g.tracks[0].t.artist }}</a></small></span>
              <small class="d">{{ fmtClock((g.tracks[0].t.ms ?? 0) / 1000) }}</small>
            </div>
            <ol v-if="isAlbum(g) && open.has('s' + i)" class="songs">
              <li v-for="(x, j) in g.tracks" :key="x.t.uri + j" :class="{ hop: canHop }" :title="canHop ? 'Hopp hit' : undefined" @click="hop(x.idx, x.t.name, x.t.uri)"><span class="n">{{ j + 1 }}</span><span class="t" translate="no"><b>{{ x.t.name }}</b></span><small class="d">{{ fmtClock((x.t.ms ?? 0) / 1000) }}</small></li>
            </ol>
          </li>
        </ol>
        <ol v-else>
          <li v-for="(t, i) in spotQueue.slice(0, 12)" :key="t.uri + i" :class="{ hop: canHop }" :title="canHop ? 'Hopp hit' : undefined" @click="hop(i, t.name, t.uri)">
            <img v-if="t.img" crossorigin="anonymous" :src="t.img" alt="" /><span v-else class="ph"><Music :size="13" /></span>
            <span class="t" translate="no"><b>{{ t.name }}</b><small><a v-if="t.artist" class="lnk" href="#" title="Åpne artisten" @click.stop.prevent="openArtistOf(t)">{{ t.artist }}</a></small></span>
            <small class="d">{{ fmtClock((t.ms ?? 0) / 1000) }}</small>
          </li>
        </ol>
      </template>
    </template>
  </section>
</template>

<style scoped>
.hop { cursor: pointer; }
.gh.hop:hover, li.hop:hover { background: var(--accent-soft); border-radius: 10px; }
.hopb { position: relative; flex: none; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: transparent; cursor: pointer; overflow: hidden; }
.hopb img, .hopb .ph { grid-area: 1 / 1; }
.hopb .hopi { grid-area: 1 / 1; z-index: 1; color: #fff; opacity: 0; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6)); transition: opacity 0.15s; }
.hopb:hover .hopi, .hopb:focus-visible .hopi { opacity: 1; }
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
.lnk { color: inherit; text-decoration: none; }
.lnk:hover { color: var(--accent); text-decoration: underline; }
.bar { display: flex; align-items: center; gap: 6px; }
.edit { white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border: 0; border-radius: 999px; background: var(--glass); color: var(--text-2); font: 600 0.72rem var(--font); cursor: pointer; }
.edit:hover { color: var(--accent); }
.edit.on { background: var(--accent); color: #fff; }
.bar .lnk { display: inline-flex; align-items: center; gap: 3px; margin-left: auto; padding: 0; border: 0; background: none; color: #d24b4b; font: 600 0.74rem var(--font); cursor: pointer; }
.hint { margin: 0; padding: 6px 10px; border-radius: 10px; background: var(--accent-soft); color: var(--text-2); font-size: 0.74rem; line-height: 1.35; }
.lists { display: grid; gap: 3px; max-height: 440px; overflow-y: auto; overscroll-behavior: contain; }
.div { padding: 8px 4px 2px; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); border-top: 1px solid var(--glass-border); margin-top: 4px; }
.div small { margin-left: 6px; font-weight: 500; letter-spacing: 0; text-transform: none; }
.div.mine { border-top: 0; margin-top: 0; padding-top: 0; color: var(--accent); }
.grp.over { box-shadow: inset 0 2px 0 var(--accent); }
.grp.dragging { opacity: 0.4; }
.gh .open { min-width: 0; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: var(--text); text-align: left; cursor: pointer; font: inherit; }
.lists .gh { grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px; }
.lists .gh:hover { background: transparent; }
.lists .gh .open { grid-column: 2; }
.lists .gh:has(.grip) { grid-template-columns: 20px minmax(0, 1fr) auto; }
.grip { display: grid; place-items: center; width: 20px; height: 36px; color: var(--text-3); cursor: grab; }
.lk { margin-left: 5px; color: var(--text-3); vertical-align: -1px; }
.acts { display: inline-flex; gap: 2px; flex: none; }
.acts button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 8px; background: var(--glass); color: var(--text-2); cursor: pointer; }
.acts button:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent); }
.acts button:disabled { opacity: 0.35; cursor: default; }
.acts .x:hover { background: rgba(210, 75, 75, 0.16); color: #d24b4b; }
.acts.s button { width: 22px; height: 22px; border-radius: 6px; }
.songs li { grid-template-columns: 18px minmax(0, 1fr) auto auto; }
</style>
