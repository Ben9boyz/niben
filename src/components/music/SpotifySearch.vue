<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Play, Lock, Plus, Check, Music, CirclePlus, ListEnd } from 'lucide-vue-next'
import { spotify, lockLeft, type SearchResults, fmtClock, play, lockNote, searchSpotify, saveAlbum, addToPlaylist, addGuest, control, followPlaylist, enqueue } from '@/composables/music/useSpotify'
import { room } from '@/composables/useRoom'
import { mode } from '@/composables/useMode'
import { admin, errorMessage } from '@/composables/useAdmin'
import type { Album, Playlist, Track } from '@/types'
import MusicDetail from './MusicDetail.vue'
import AddMenu from './AddMenu.vue'
import { startTrackDrag, endDrag } from '@/composables/music/useDrag'
import { showMenu, longPress } from '@/composables/useContextMenu'
import { trackMenu } from '@/lib/menus'
import { openAlbumPage, openArtistPage, albumOfTrack, firstArtist } from '@/composables/music/useBrowse'

// Search results. 'all' (the flat grid): my playlists, albums and songs. 'player' (the turntable):
// only albums and songs. Songs start inside their album, so the music carries on after the song.
// Albums and songs come from all of Spotify (admin only); my own albums/playlists are matched locally.
const props = withDefaults(defineProps<{
  q?: string
  scope?: 'all' | 'player'
  // the tab it is opened from decides the order and what is shown: Spillelister → songs, playlists, albums ·
  // Album → albums, songs, artists (no playlists)
  tab?: 'vinyl' | 'ipod'
}>(), { q: '', scope: 'all', tab: 'vinyl' })
const emit = defineEmits(['clear'])

const nothing = (): SearchResults => ({ albums: [], tracks: [], playlists: [], artists: [] })
const found = ref<SearchResults>(nothing())
const state = ref('idle') // idle | loading | error
const error = ref('')
const msg = ref<{ ok?: string; error?: string } | null>(null)
const open = ref<{ item: Album | Playlist; kind: 'album' | 'playlist' } | null>(null) // an album/playlist opened from the results
const menuFor = ref<string | null>(null) // track uri whose "add to playlist" list is open
const busy = ref<string | null>(null)
const locked = computed(() => lockLeft.value > 0)

const needle = computed(() => props.q.trim().toLowerCase())
const mine = computed(() => new Set(spotify.albums.map((a) => a.uri)))
const wantPlaylists = computed(() => props.scope === 'all' && props.tab === 'ipod')
const ORDER = computed(() => (props.tab === 'ipod' ? { tracks: 1, myPlaylists: 2, otherPlaylists: 3, myAlbums: 4, otherAlbums: 5, artists: 6 } : { myAlbums: 1, otherAlbums: 2, tracks: 3, artists: 4 }))
const myPlaylists = computed(() => (wantPlaylists.value && needle.value ? spotify.playlists.filter((p) => p.name.toLowerCase().includes(needle.value)) : []))
const myAlbums = computed(() => (needle.value ? spotify.albums.filter((a) => `${a.name} ${a.artist}`.toLowerCase().includes(needle.value)) : []))
// from Spotify, minus the ones I already have in the list above
const otherAlbums = computed(() => found.value.albums.filter((a) => !mine.value.has(a.uri)))
// playlists from all of Spotify (the flat page only – in the room, playlists are the iPod's)
const myPlaylistUris = computed(() => new Set(spotify.playlists.map((p) => p.uri)))
const otherPlaylists = computed(() => (wantPlaylists.value ? (found.value.playlists || []).filter((p) => !myPlaylistUris.value.has(p.uri)) : []))

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(() => props.q, (q) => {
  clearTimeout(timer)
  const t = q.trim()
  if (t.length < 2 || !admin.mine) { found.value = nothing(); state.value = 'idle'; return }
  state.value = 'loading'
  const mySeq = ++seq
  timer = setTimeout(async () => {
    try {
      const r = await searchSpotify(t)
      if (mySeq !== seq) return
      found.value = r
      state.value = 'idle'
    } catch (e) {
      if (mySeq !== seq) return
      error.value = errorMessage(e)
      state.value = 'error'
    }
  }, 350)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

// flat page: the album opens here. In the room: the record flies in (guests) or comes off the shelf and is
// held up – the panel's own album view takes over (VinylPanel), and "back" returns to these results
function openAlbum(item: Album) {
  if (mode.value === 'rom') {
    addGuest(item)
    room.musicView = 'vinyl'
    room.sel.musikk = { kind: 'album', uri: item.uri, t: Date.now() }
  } else open.value = { item, kind: 'album' }
}
const albumOf = (t: Track): Album => ({ uri: t.album_uri ?? '', name: t.album ?? '', artist: t.album_artist ?? '', image: t.album_image, image_large: t.album_image_large, url: t.album_url })

async function playTrack(t: Track) {
  if (!admin.mine || busy.value) return
  if (spotify.now?.uri === t.uri) { // already on: pause / resume works even while locked
    const r = await control(spotify.now?.playing ? 'pause' : 'resume')
    msg.value = r.ok ? null : { error: r.error }
    return
  }
  if (locked.value) { msg.value = { error: `Låst – hør ferdig (${fmtClock(lockLeft.value)} igjen)` }; return }
  addGuest(albumOf(t)) // an album that isn't on the shelf gets a record by the turntable
  busy.value = t.uri
  // searching in the Album tab and the song is on an album I own → it plays on the turntable; everything else found by
  // searching (Spillelister tab, albums I don't have) goes on the iPod
  const onShelf = props.tab === 'vinyl' && spotify.albums.some((a) => a.uri === t.album_uri)
  const r = await play(t.album_uri ?? '', t.uri, onShelf ? {} : { from: 'search' })
  busy.value = null
  msg.value = r.ok ? { ok: `Spiller «${t.name}»${lockNote()}` } : { error: r.error }
}
async function save(a: Album) {
  busy.value = a.uri
  const r = await saveAlbum(a.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `«${a.name}» ligger nå blant albumene dine.` } : { error: r.error }
}
async function follow(p: Playlist) {
  busy.value = p.uri
  const r = await followPlaylist(p.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `«${p.name}» ligger nå blant spillelistene dine.` } : { error: r.error }
}
async function addTo(t: Track, pl: Playlist) {
  menuFor.value = null
  busy.value = t.uri
  const r = await addToPlaylist(pl.uri, t.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `«${t.name}» er lagt til i «${pl.name}».` } : { error: r.error }
}
const none = computed(() => needle.value.length >= 2 && state.value === 'idle' && !myPlaylists.value.length && !myAlbums.value.length && !otherAlbums.value.length && !otherPlaylists.value.length && !found.value.tracks.length && !(found.value.artists || []).length)
</script>

<template>
  <div class="ss">
    <MusicDetail v-if="open" :key="open.item.uri" :item="open.item" :kind="open.kind" back-label="Tilbake til søket" @back="open = null" />

    <template v-else>
      <p v-if="msg?.ok" class="notice ok" :style="{ order: 0 }">{{ msg.ok }}</p>
      <p v-if="msg?.error" class="notice error" :style="{ order: 0 }">{{ msg.error }}</p>

      <section v-if="myPlaylists.length" :style="{ order: ORDER.myPlaylists }">
        <h4>Mine spillelister</h4>
        <button v-for="p in myPlaylists" :key="p.uri" class="row" @click="open = { item: p, kind: 'playlist' }">
          <img v-if="p.thumb || p.image" crossorigin="anonymous" :src="p.thumb || p.image || undefined" alt="" class="art" />
          <span v-else class="art ph"><Music :size="16" /></span>
          <span class="t" translate="no"><b>{{ p.name }}</b><small>{{ p.count ? `${p.count} låter` : p.owner }}</small></span>
        </button>
      </section>

      <section v-if="myAlbums.length" :style="{ order: ORDER.myAlbums }">
        <h4>Mine album</h4>
        <button v-for="a in myAlbums.slice(0, 12)" :key="a.uri" class="row" @click="openAlbum(a)">
          <img v-if="a.thumb || a.image" crossorigin="anonymous" :src="a.thumb || a.image || undefined" alt="" class="art" />
          <span class="t"><b>{{ a.name }}</b><small>{{ a.artist }}<template v-if="a.year"> · {{ a.year }}</template></small></span>
        </button>
      </section>

      <p v-if="needle.length >= 2 && !admin.mine" class="hint" :style="{ order: 0 }">Logg inn for å søke i hele Spotify.</p>
      <p v-else-if="state === 'loading'" class="hint" :style="{ order: 0 }">Søker …</p>
      <p v-else-if="state === 'error'" class="notice error" :style="{ order: 0 }">{{ error }}</p>

      <section v-if="otherAlbums.length" :style="{ order: ORDER.otherAlbums }">
        <h4>Album på Spotify</h4>
        <div v-for="a in otherAlbums" :key="a.uri" class="row wrap">
          <button class="main" @click="openAlbum(a)">
            <img v-if="a.thumb || a.image" crossorigin="anonymous" :src="a.thumb || a.image || undefined" alt="" class="art" />
            <span class="t"><b>{{ a.name }}</b><small>{{ a.artist }}<template v-if="a.year"> · {{ a.year }}</template></small></span>
          </button>
          <button class="act" :disabled="busy === a.uri" title="Legg i albumene dine (biblioteket)" @click="save(a)"><Plus :size="15" />Legg til</button>
        </div>
      </section>

      <section v-if="otherPlaylists.length" :style="{ order: ORDER.otherPlaylists }">
        <h4>Spillelister på Spotify</h4>
        <div v-for="p in otherPlaylists" :key="p.uri" class="row wrap">
          <button class="main" @click="open = { item: p, kind: 'playlist' }">
            <img v-if="p.thumb || p.image" crossorigin="anonymous" :src="p.thumb || p.image || undefined" alt="" class="art" />
            <span v-else class="art ph"><Music :size="16" /></span>
            <span class="t" translate="no"><b>{{ p.name }}</b><small>{{ p.owner }}<template v-if="p.count"> · {{ p.count }} låter</template></small></span>
          </button>
          <button class="act" :disabled="busy === p.uri" title="Lagre blant spillelistene dine" @click="follow(p)"><Plus :size="15" />Lagre</button>
        </div>
      </section>

      <section v-if="found.tracks.length" :style="{ order: ORDER.tracks }">
        <h4>Låter</h4>
        <div v-for="t in found.tracks" :key="t.uri" class="trk">
          <div class="row wrap" :draggable="admin.mine || undefined" @dragstart="startTrackDrag($event, t)" @dragend="endDrag" @contextmenu="showMenu($event, t.name, trackMenu(t, { onPlay: () => playTrack(t) }))" v-on="longPress((e) => showMenu(e, t.name, trackMenu(t, { onPlay: () => playTrack(t) })))">
            <div class="main songrow" :class="{ dim: locked && spotify.now?.uri !== t.uri }">
              <button class="plain" :disabled="!!busy" :title="locked ? `Låst ${fmtClock(lockLeft)}` : 'Spill låta i albumet'" :aria-label="`Spill ${t.name}`" @click="playTrack(t)">
                <img v-if="t.album_image" crossorigin="anonymous" :src="t.album_image" alt="" class="art" />
                <span v-else class="art ph"><Music :size="16" /></span>
              </button>
              <span class="t">
                <button class="plain nm" :disabled="!!busy" @click="playTrack(t)"><b>{{ t.name }}</b></button>
                <small>
                  <a v-if="admin.mine" class="lnk" href="#" title="Åpne artisten og albumene" @click.prevent="openArtistPage({ id: t.artist_id, name: firstArtist(t.artist) })">{{ t.artist }}</a><template v-else>{{ t.artist }}</template>
                  · <a v-if="admin.mine && t.album_uri" class="lnk" href="#" title="Åpne albumet" @click.prevent="mode === 'rom' ? openAlbum(albumOf(t)) : openAlbumPage(albumOfTrack(t))">{{ t.album }}</a><template v-else>{{ t.album }}</template>
                </small>
              </span>
              <span v-if="admin.mine" class="ics">
                <button class="ic" title="Spill etterpå – legg til sist i køen" aria-label="Legg til sist i køen" @click="enqueue(t)"><ListEnd :size="17" /></button>
                <button class="ic" :class="{ on: menuFor === t.uri }" title="Legg til i en spilleliste" aria-label="Legg til i en spilleliste" @click="menuFor = menuFor === t.uri ? null : t.uri"><CirclePlus :size="19" /></button>
              </span>
              <button class="plain d" :disabled="!!busy" @click="playTrack(t)"><Lock v-if="locked" :size="13" /><Play v-else :size="13" fill="currentColor" /> {{ fmtClock((t.ms ?? 0) / 1000) }}</button>
            </div>
          </div>
          <div v-if="menuFor === t.uri" class="menu"><AddMenu @queue="menuFor = null; enqueue(t)" @pick="(p) => addTo(t, p)" @close="menuFor = null" /></div>
        </div>
      </section>

      <section v-if="found.artists?.length" :style="{ order: ORDER.artists }">
        <h4>Artister</h4>
        <button v-for="a in found.artists" :key="a.id" class="row" @click="openArtistPage({ id: a.id, name: a.name })">
          <img v-if="a.image" crossorigin="anonymous" :src="a.image" alt="" class="art round" />
          <span v-else class="art ph round"><Music :size="16" /></span>
          <span class="t" translate="no"><b>{{ a.name }}</b><small>{{ a.genres?.join(' · ') || 'Artist' }}</small></span>
        </button>
      </section>

      <p v-if="none" class="hint" :style="{ order: 9 }">Ingen treff på «{{ q.trim() }}».</p>
    </template>
  </div>
</template>

<style scoped>
.ss { display: grid; gap: 14px; min-width: 0; }
section { display: grid; gap: 2px; }
h4 { margin: 0 2px 4px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.hint { margin: 0; color: var(--text-3); font-size: 0.85rem; }
.row, .main { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 6px 8px; border: 0; border-radius: 12px; background: transparent; color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.row:hover, .main:hover:not(:disabled) { background: var(--accent-soft); }
.row.wrap { padding: 0; gap: 6px; }
.row.wrap:hover { background: transparent; }
.main { flex: 1; }
.main:disabled { cursor: not-allowed; }
.main.dim { opacity: 0.6; }
.art { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex: none; background: var(--glass-strong); }
.art.round { border-radius: 50%; }
.art.ph { display: grid; place-items: center; color: var(--text-3); }
.t { display: grid; min-width: 0; flex: 1; }
.t b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.t small { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d { display: inline-flex; align-items: center; gap: 5px; color: var(--text-3); font-size: 0.78rem; font-variant-numeric: tabular-nums; flex: none; }
.act { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 6px 10px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-2); font: 600 0.75rem var(--font); cursor: pointer; }
.act:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.songrow { cursor: default; }
.ics { display: inline-flex; align-items: center; gap: 2px; flex: none; }
.ic { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-3); cursor: pointer; transition: color 0.15s, background 0.15s; }
.ic:hover, .ic.on { color: var(--accent); background: var(--accent-soft); }
@media (hover: hover) and (pointer: fine) { .ics { opacity: 0; transition: opacity 0.15s; } .trk:hover .ics, .ics:focus-within { opacity: 1; } }
.plain { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; }
.plain:disabled { cursor: not-allowed; }
.nm { display: block; max-width: 100%; }
.lnk { color: inherit; text-decoration: none; }
.lnk:hover { color: var(--accent); text-decoration: underline; }
.menu { margin: 2px 0 6px 54px; }
@media (max-width: 560px) {
  /* phones: queue + plus sit at the end of the same line as the song */
  .lnk { padding: 3px 0; }
}
</style>
