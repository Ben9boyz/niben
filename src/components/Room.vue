<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRoom } from '../three/room'
import { room, clearSelection } from '../composables/useRoom'
import { useData } from '../composables/useData'
import { useTheme } from '../composables/useTheme'
import { timer, timerState, toggle as toggleTimer } from '../composables/useTimer'
import { spotify, useSpotify, prefetchTracks, fetchTracks, fetchTempo, fetchQueue, control, findAlbum, addGuest } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { useVinylNoise } from '../composables/useVinylNoise'
import { shelfAlbums, loadGroups } from '../composables/useGroups'
import { jp, loadJapanese } from '../composables/useJapanese'
import { steam, loadSteam } from '../composables/useSteam'

const host = ref(null)
const route = useRoute()
const router = useRouter()
const data = useData()
const { theme } = useTheme()
const failed = ref(false)
useVinylNoise() // a quiet crackle on the music while it plays in the room
useSpotify() // keeps records/iPod in the room up to date
loadGroups() // the shelf order may follow my folders
let api

const ROUTES = { hjem: '/', japansk: '/japansk', gaming: '/gaming', lytte: '/lytte', ovelse: '/ovelse', gitar: '/gitar', boker: '/boker', reiser: '/reiser', kode: '/kode', om: '/om' }

let nextPeek = null // the record clicked on the way down to the shelf (pulled out first)
function onPick(p) {
  if (p.kind === 'station') { router.push(ROUTES[p.station]); return }
  if (p.kind === 'stackrecord') {
    if (!p.album) return
    // a record from the stack: pick it up like one from the shelf (an album I don't have gets a guest record)
    if (!findAlbum(p.album.uri)) addGuest({ uri: p.album.uri, name: p.album.name, artist: p.album.artist, image: p.album.image, image_large: p.album.image_large })
    room.musicView = 'vinyl'
    room.sel.musikk = { kind: 'album', uri: p.album.uri, t: Date.now() }
    return
  }
  if (p.kind === 'turntable') { if (spotify.now?.name && admin.loggedIn) control(spotify.now.playing ? 'pause' : 'resume'); return }
  if (p.kind === 'guitar') room.sel.gitar = p.index
  else if (p.kind === 'book') room.sel.bok = room.sel.bok === p.index ? -1 : p.index
  else if (p.kind === 'country') room.sel.land = room.sel.land === p.name ? null : p.name
  else if (p.kind === 'clock') toggleTimer()
  else if (p.kind === 'album') {
    room.musicView = 'vinyl'
    const take = () => { room.sel.musikk = { kind: 'album', uri: p.uri, t: Date.now() } }
    // the record in your hands: turn it over (track list on the back)
    if (room.sel.musikk?.uri === p.uri) { room.recordFlipped = !room.recordFlipped; return }
    // the record that's playing (by the turntable): pick it up
    if (!room.shelfView && p.uri === spotify.now?.context) { take(); return }
    const i = shelfAlbums.value.findIndex((a) => a.uri === p.uri)
    // from the turntable view, a click on a record takes you down to the shelf with that record pulled out
    if (!room.shelfView) { nextPeek = i >= 0 ? i : null; room.sel.musikk = null; room.shelfView = true; return }
    // at the shelf: click a record to pull it out, click the pulled-out one to take it
    if (room.sel.musikk || i === room.peekIndex) take()
    else if (i >= 0) room.peekIndex = i
  } else if (p.kind === 'shelf') {
    // the sideboard itself: go down to the shelf and browse
    if (!room.shelfView) { room.musicView = 'vinyl'; room.sel.musikk = null; room.shelfView = true }
  } else if (p.kind === 'anime') room.jpAnime = room.jpAnime === p.index ? -1 : p.index
  else if (p.kind === 'ipod') room.musicView = 'ipod'
  else if (p.kind === 'screen') {
    const n = data.prosjekter?.length || 0
    if (n) room.sel.prosjekt = (room.sel.prosjekt + 1) % n
  } else if (p.kind === 'empty') {
    if (route.name === 'lytte') {
      if (!room.sel.musikk && room.musicView !== 'ipod') room.shelfView = false // back up to the turntable
      room.sel.musikk = null
      room.musicView = 'vinyl'
    }
    room.sel.bok = -1
    room.sel.land = null
    room.jpAnime = -1
  }
}

onMounted(() => {
  try {
    api = createRoom(host.value, {
      onPick,
      onHover: (h) => { room.hover = h; if (h?.uri) prefetchTracks(h.uri) },
      onReady: () => (room.ready = true),
      timerState,
    })
  } catch (e) {
    console.error(e)
    failed.value = true
    room.ready = true
    return
  }
  room.api = api
  if (import.meta.env.DEV) window.__room = api
  api.setTheme(theme.value)
  api.setTimerInterval(timer.interval)
  api.setMusic(sceneMusic())
  api.setStack(stackItems.value)
  if (spotify.now?.uri) fetchTempo(spotify.now.uri).then((b) => { if (api && spotify.now?.uri) api.setTempo(b) })
  if (data.loaded) api.setData(data)
  api.goTo(route.name || 'hjem', { duration: 2.6 })
})

watch(() => data.version, () => data.loaded && api?.setData(data))
// the word of the day on the card in the Japanese corner
loadJapanese()
watch(() => [jp.word, room.api], () => room.api?.setJapanWord(jp.word), { immediate: true })
// the monitor in the gaming corner shows Steam
loadSteam()
watch(() => [steam.profile, steam.library, room.api], () => room.api?.setSteam({ profile: steam.profile, library: steam.library }), { immediate: true })
// …and the anime from the decks as DVDs stacked on the mat
watch(() => [jp.anime, room.jpAnime, room.api], () => room.api?.setAnime(jp.anime, room.jpAnime), { immediate: true })
watch(theme, (t) => api?.setTheme(t))
watch(() => timer.interval, (v) => api?.setTimerInterval(v))
// the records stand in the shelf's order (by artist, or by my folders)
// the stack on the table: the albums coming up in the queue on top (next first), the ones I heard last below
const queuedTracks = ref([])
async function loadQueue() { queuedTracks.value = spotify.connected && spotify.now?.name ? await fetchQueue() : [] }
watch(() => [spotify.now?.uri, spotify.queueV, spotify.connected], loadQueue, { immediate: true })
const stackItems = computed(() => {
  const ctx = String(spotify.now?.context || '')
  const playingAlbum = ctx.startsWith('spotify:album:') ? ctx : null
  const seen = new Set(playingAlbum ? [playingAlbum] : [])
  const out = []
  // queued songs from other albums (only when an album, not a playlist, is playing – in a playlist the next songs
  // would all look "queued")
  if (!ctx || playingAlbum) {
    for (const t of queuedTracks.value) {
      if (!t.album_uri || seen.has(t.album_uri)) continue
      seen.add(t.album_uri)
      out.push({ uri: t.album_uri, name: t.album, artist: t.album_artist, image: t.album_image, image_large: t.album_image, queued: true })
    }
  }
  let recent = 0
  for (const a of spotify.recent || []) {
    if (recent >= 3) break
    if (seen.has(a.uri)) continue
    seen.add(a.uri)
    recent++
    out.push({ ...a, queued: false })
  }
  return out
})
watch(stackItems, (v) => api?.setStack(v), { deep: false })
// the turntable spins to the tempo of the song (4 beats – one bar – per turn)
watch(() => spotify.now?.uri, async (uri) => {
  const bpm = uri ? await fetchTempo(uri) : 0
  if (spotify.now?.uri === uri) api?.setTempo(bpm)
}, { immediate: false })
const sceneMusic = () => ({ albums: shelfAlbums.value, playlists: spotify.playlists, now: spotify.now, guests: spotify.guests })
watch(() => [shelfAlbums.value, spotify.playlists, spotify.now, spotify.guests], () => api?.setMusic(sceneMusic()), { deep: false })
// typing in the shelf search: the matching records slide out (only a handful – more would just be a mess)
watch(() => [room.shelfQ, spotify.albums, route.name], () => {
  const n = room.shelfQ.trim().toLowerCase()
  const hits = n && route.name === 'lytte' ? spotify.albums.filter((a) => `${a.name} ${a.artist}`.toLowerCase().includes(n)).map((a) => a.uri) : null
  api?.setShelfFilter(hits && hits.length <= 24 ? hits : null)
})
// arriving at the shelf: the record you clicked is pulled out – or a random one if you clicked the
// sideboard itself
watch(() => room.shelfView, (on) => {
  const n = Math.min(shelfAlbums.value.length, 150)
  if (on && n) room.peekIndex = nextPeek ?? Math.floor(Math.random() * n)
  nextPeek = null
})
// fetch the track list as soon as a record is pulled out or taken, so it's there when you turn it over
watch(() => [room.shelfView && shelfAlbums.value[room.peekIndex]?.uri, room.sel.musikk?.uri], (uris) => {
  for (const uri of uris) if (uri) fetchTracks(uri)
})
watch(() => [route.name, room.sel.musikk, room.musicView, room.panelHidden, room.shelfView, room.recordFlipped, room.peekIndex, shelfAlbums.value], () => {
  const here = route.name === 'lytte'
  api?.setMusicView({
    // the picked record is held up to the camera – not in the overhead view, where it lies by the turntable
    selected: here && room.musicView !== 'spiller' && room.sel.musikk?.kind === 'album' ? room.sel.musikk.uri : null,
    ipod: here && room.musicView === 'ipod',
    big: room.panelHidden, // no panel: the held iPod can fill much more of the screen
    // "Album": the camera stays by the turntable · "Spillelister": by the iPod on its stand
    // (picking something lifts the iPod up in front of the camera)
    pose: !here ? null : room.musicView.startsWith('ipod') ? 'ipod' : room.shelfView ? 'shelf' : 'top',
    flip: room.recordFlipped,
    peek: here && room.shelfView && !room.sel.musikk && room.musicView === 'vinyl' ? shelfAlbums.value[room.peekIndex]?.uri || null : null,
  })
})
// started from this page: the side panel slides away and the camera settles on what's playing –
// a record goes onto the turntable ('spiller' = turntable camera, record not held up), a playlist
// puts the iPod back on its stand and the camera looks at it ('ipodDock'). Picking another record
// holds that one up; picking up the iPod (click it / the tab) takes it in hand again.
watch(() => spotify.startedHere, () => {
  if (route.name !== 'lytte') return
  room.musicView = room.musicView.startsWith('ipod') ? 'ipodDock' : 'spiller'
  room.shelfView = false
  room.recordFlipped = false
  if (window.matchMedia('(min-width: 901px)').matches) room.panelHidden = true
})
watch(() => room.sel.musikk?.uri, (uri) => {
  room.recordFlipped = false
  if (uri && room.musicView === 'spiller') room.musicView = 'vinyl'
})
watch(() => route.name, (n) => {
  clearSelection()
  api?.goTo(n || 'hjem')
})
watch(() => ({ ...room.sel }), (s) => api?.setSelection(s), { deep: true })

// the room's name tag belongs to the 3D view: drop it as soon as the pointer is over the panel or
// any other UI (the canvas doesn't always get a 'leave' when a panel slides in under a still pointer)
function onWindowMove(e) {
  if (room.hover && e.target?.tagName !== 'CANVAS') room.hover = null
}
window.addEventListener('pointermove', onWindowMove, { passive: true })
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onWindowMove)
  api?.dispose()
  room.api = null
})
</script>

<template>
  <div ref="host" class="room" aria-label="3D-rom" role="img"></div>
  <transition name="fade">
    <!-- (not over the record held up – its name is already shown under it) -->
    <div v-if="room.hover && !(room.hover.uri && room.hover.uri === room.sel.musikk?.uri && room.musicView === 'vinyl')" class="tip" :style="{ transform: `translate(${room.hover.x + 16}px, ${room.hover.y + 16}px)` }">
      {{ room.hover.label }}
    </div>
  </transition>
  <p v-if="failed" class="nogl">Nettleseren din støtter ikke 3D (WebGL), men du kan fortsatt bruke menyen.</p>
</template>

<style scoped>
.room {
  position: fixed;
  inset: 0;
  z-index: 0;
}
.room :deep(canvas) { display: block; width: 100%; height: 100%; touch-action: none; }
.tip {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 30;
  pointer-events: none;
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  background: var(--glass-strong);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-1);
  white-space: nowrap;
}
.nogl {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 320px;
  text-align: center;
  color: var(--text-2);
}
@media (hover: none) { .tip { display: none; } }
</style>
