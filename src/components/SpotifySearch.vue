<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Play, Lock, Plus, Check, Music, ListPlus, ListEnd, Disc3, User } from 'lucide-vue-next'
import { spotify, lockLeft, fmtClock, play, lockNote, searchSpotify, saveAlbum, addToPlaylist, addGuest, control, followPlaylist, enqueue } from '../composables/useSpotify'
import { room } from '../composables/useRoom'
import { mode } from '../composables/useMode'
import { admin } from '../composables/useAdmin'
import MusicDetail from './MusicDetail.vue'
import AddMenu from './AddMenu.vue'
import { startTrackDrag, endDrag } from '../composables/useDrag'
import { openAlbumPage, openArtistPage, albumOfTrack, firstArtist } from '../composables/useBrowse'

// Search results. 'all' (the flat grid): my playlists, albums and songs. 'player' (the turntable):
// only albums and songs. Songs start inside their album, so the music carries on after the song.
// Albums and songs come from all of Spotify (admin only); my own albums/playlists are matched locally.
const props = defineProps({
  q: { type: String, default: '' },
  scope: { type: String, default: 'all' }, // 'all' | 'player'
})
const emit = defineEmits(['clear'])

const found = ref({ albums: [], tracks: [], playlists: [] })
const state = ref('idle') // idle | loading | error
const error = ref('')
const msg = ref(null)
const open = ref(null) // { item, kind } – an album/playlist opened from the results
const menuFor = ref(null) // track uri whose "add to playlist" list is open
const busy = ref(null)
const locked = computed(() => lockLeft.value > 0)

const needle = computed(() => props.q.trim().toLowerCase())
const mine = computed(() => new Set(spotify.albums.map((a) => a.uri)))
const myPlaylists = computed(() => (props.scope === 'all' && needle.value ? spotify.playlists.filter((p) => p.name.toLowerCase().includes(needle.value)) : []))
const myAlbums = computed(() => (needle.value ? spotify.albums.filter((a) => `${a.name} ${a.artist}`.toLowerCase().includes(needle.value)) : []))
// from Spotify, minus the ones I already have in the list above
const otherAlbums = computed(() => found.value.albums.filter((a) => !mine.value.has(a.uri)))
// playlists from all of Spotify (the flat page only – in the room, playlists are the iPod's)
const myPlaylistUris = computed(() => new Set(spotify.playlists.map((p) => p.uri)))
const otherPlaylists = computed(() => (props.scope === 'all' ? (found.value.playlists || []).filter((p) => !myPlaylistUris.value.has(p.uri)) : []))

let timer = 0
let seq = 0
watch(() => props.q, (q) => {
  clearTimeout(timer)
  const t = q.trim()
  if (t.length < 2 || !admin.loggedIn) { found.value = { albums: [], tracks: [], playlists: [] }; state.value = 'idle'; return }
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
      error.value = e.message
      state.value = 'error'
    }
  }, 350)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

// flat page: the album opens here. In the room: the record flies in (guests) or comes off the shelf and is
// held up – the panel's own album view takes over (VinylPanel), and "back" returns to these results
function openAlbum(item) {
  if (mode.value === 'rom') {
    addGuest(item)
    room.musicView = 'vinyl'
    room.sel.musikk = { kind: 'album', uri: item.uri, t: Date.now() }
  } else open.value = { item, kind: 'album' }
}
const albumOf = (t) => ({ uri: t.album_uri, name: t.album, artist: t.album_artist, image: t.album_image, image_large: t.album_image_large, url: t.album_url })

async function playTrack(t) {
  if (!admin.loggedIn || busy.value) return
  if (spotify.now?.uri === t.uri) { // already on: pause / resume works even while locked
    const r = await control(spotify.now.playing ? 'pause' : 'resume')
    msg.value = r.ok ? null : { error: r.error }
    return
  }
  if (locked.value) { msg.value = { error: `Låst – hør ferdig (${fmtClock(lockLeft.value)} igjen)` }; return }
  addGuest(albumOf(t)) // an album that isn't on the shelf gets a record by the turntable
  busy.value = t.uri
  const r = await play(t.album_uri, t.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `Spiller «${t.name}»${lockNote()}` } : { error: r.error }
}
async function save(a) {
  busy.value = a.uri
  const r = await saveAlbum(a.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `«${a.name}» ligger nå blant albumene dine.` } : { error: r.error }
}
async function follow(p) {
  busy.value = p.uri
  const r = await followPlaylist(p.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `«${p.name}» ligger nå blant spillelistene dine.` } : { error: r.error }
}
async function addTo(t, pl) {
  menuFor.value = null
  busy.value = t.uri
  const r = await addToPlaylist(pl.uri, t.uri)
  busy.value = null
  msg.value = r.ok ? { ok: `«${t.name}» er lagt til i «${pl.name}».` } : { error: r.error }
}
const none = computed(() => needle.value.length >= 2 && state.value === 'idle' && !myPlaylists.value.length && !myAlbums.value.length && !otherAlbums.value.length && !otherPlaylists.value.length && !found.value.tracks.length)
</script>

<template>
  <div class="ss">
    <MusicDetail v-if="open" :key="open.item.uri" :item="open.item" :kind="open.kind" back-label="Tilbake til søket" @back="open = null" />

    <template v-else>
      <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>

      <section v-if="myPlaylists.length">
        <h4>Mine spillelister</h4>
        <button v-for="p in myPlaylists" :key="p.uri" class="row" @click="open = { item: p, kind: 'playlist' }">
          <img v-if="p.thumb || p.image" crossorigin="anonymous" :src="p.thumb || p.image" alt="" class="art" />
          <span v-else class="art ph"><Music :size="16" /></span>
          <span class="t"><b>{{ p.name }}</b><small>{{ p.count ? `${p.count} låter` : p.owner }}</small></span>
        </button>
      </section>

      <section v-if="myAlbums.length">
        <h4>Mine album</h4>
        <button v-for="a in myAlbums.slice(0, 12)" :key="a.uri" class="row" @click="openAlbum(a)">
          <img v-if="a.thumb || a.image" crossorigin="anonymous" :src="a.thumb || a.image" alt="" class="art" />
          <span class="t"><b>{{ a.name }}</b><small>{{ a.artist }}<template v-if="a.year"> · {{ a.year }}</template></small></span>
        </button>
      </section>

      <p v-if="needle.length >= 2 && !admin.loggedIn" class="hint">Logg inn for å søke i hele Spotify.</p>
      <p v-else-if="state === 'loading'" class="hint">Søker …</p>
      <p v-else-if="state === 'error'" class="notice error">{{ error }}</p>

      <section v-if="otherAlbums.length">
        <h4>Album på Spotify</h4>
        <div v-for="a in otherAlbums" :key="a.uri" class="row wrap">
          <button class="main" @click="openAlbum(a)">
            <img v-if="a.thumb || a.image" crossorigin="anonymous" :src="a.thumb || a.image" alt="" class="art" />
            <span class="t"><b>{{ a.name }}</b><small>{{ a.artist }}<template v-if="a.year"> · {{ a.year }}</template></small></span>
          </button>
          <button class="act" :disabled="busy === a.uri" title="Legg i albumene dine (biblioteket)" @click="save(a)"><Plus :size="15" />Legg til</button>
        </div>
      </section>

      <section v-if="otherPlaylists.length">
        <h4>Spillelister på Spotify</h4>
        <div v-for="p in otherPlaylists" :key="p.uri" class="row wrap">
          <button class="main" @click="open = { item: p, kind: 'playlist' }">
            <img v-if="p.thumb || p.image" crossorigin="anonymous" :src="p.thumb || p.image" alt="" class="art" />
            <span v-else class="art ph"><Music :size="16" /></span>
            <span class="t"><b>{{ p.name }}</b><small>{{ p.owner }}<template v-if="p.count"> · {{ p.count }} låter</template></small></span>
          </button>
          <button class="act" :disabled="busy === p.uri" title="Lagre blant spillelistene dine" @click="follow(p)"><Plus :size="15" />Lagre</button>
        </div>
      </section>

      <section v-if="found.tracks.length">
        <h4>Låter</h4>
        <div v-for="t in found.tracks" :key="t.uri" class="trk">
          <div class="row wrap" :draggable="admin.loggedIn || undefined" @dragstart="startTrackDrag($event, t)" @dragend="endDrag">
            <button class="main" :class="{ dim: locked && spotify.now?.uri !== t.uri }" :disabled="!!busy" :title="locked ? `Låst ${fmtClock(lockLeft)}` : 'Spill låta i albumet'" @click="playTrack(t)">
              <img v-if="t.album_image" crossorigin="anonymous" :src="t.album_image" alt="" class="art" />
              <span v-else class="art ph"><Music :size="16" /></span>
              <span class="t"><b>{{ t.name }}</b><small>{{ t.artist }} · {{ t.album }}</small></span>
              <span class="d"><Lock v-if="locked" :size="13" /><Play v-else :size="13" fill="currentColor" /> {{ fmtClock(t.ms / 1000) }}</span>
            </button>
            <button v-if="admin.loggedIn && t.album_uri" class="act" title="Åpne albumet" @click="mode === 'rom' ? openAlbum(albumOf(t)) : openAlbumPage(albumOfTrack(t))"><Disc3 :size="15" /><span class="lb">Album</span></button>
            <button v-if="admin.loggedIn && mode !== 'rom'" class="act" title="Åpne artisten og albumene" @click="openArtistPage({ id: t.artist_id, name: firstArtist(t.artist) })"><User :size="15" /><span class="lb">Artist</span></button>
            <button class="act" title="Spill etterpå – i køen" aria-label="Spill etterpå" @click="enqueue(t.uri)"><ListEnd :size="15" /><span class="lb">Kø</span></button>
            <button class="act" title="Legg til i en spilleliste" @click="menuFor = menuFor === t.uri ? null : t.uri"><ListPlus :size="15" /><span class="lb">Liste</span></button>
          </div>
          <div v-if="menuFor === t.uri" class="menu"><AddMenu @queue="menuFor = null; enqueue(t.uri)" @pick="(p) => addTo(t, p)" @close="menuFor = null" /></div>
        </div>
      </section>

      <p v-if="none" class="hint">Ingen treff på «{{ q.trim() }}».</p>
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
.art.ph { display: grid; place-items: center; color: var(--text-3); }
.t { display: grid; min-width: 0; flex: 1; }
.t b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.t small { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d { display: inline-flex; align-items: center; gap: 5px; color: var(--text-3); font-size: 0.78rem; font-variant-numeric: tabular-nums; flex: none; }
.act { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 6px 10px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-2); font: 600 0.75rem var(--font); cursor: pointer; }
.act:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.menu { margin: 2px 0 6px 54px; }
@media (max-width: 560px) {
  /* phones: the song gets the whole line, its buttons (album · artist · queue · playlist) sit under it */
  .trk .row.wrap { flex-wrap: wrap; row-gap: 2px; }
  .trk .main { flex: 1 1 100%; }
  .trk .act { margin-left: 0; padding: 7px 12px; }
  .trk .row.wrap > .act:first-of-type { margin-left: 54px; }
}
</style>
