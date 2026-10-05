<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRoom, type PickEvent } from '../three/room'
import { room, clearSelection } from '../composables/useRoom'
import { useData } from '../composables/useData'
import { useTheme } from '../composables/useTheme'
import { timer, timerState, toggle as toggleTimer } from '../composables/useTimer'
import { myQueue } from '../composables/useQueue'
import { spotify, useSpotify, prefetchTracks, fetchTracks, fetchTempo, fetchQueue, control, findAlbum, addGuest } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { useVinylNoise } from '../composables/useVinylNoise'
import { gfxPayload } from '../composables/useGraphics'
import { dailyAlbum } from '../composables/useDaily'
import { playOn, targetFor } from '../composables/usePlayOn'
import { decor, loadDecor, changed as decorChanged } from '../composables/useDecor'
import { weather } from '../composables/useLive'
import { calm } from '../composables/useCalm'
import { shelfAlbums, loadGroups } from '../composables/useGroups'
import { jp, loadJapanese } from '../composables/useJapanese'
import { steam, loadSteam } from '../composables/useSteam'
import { targetEl } from '../lib/dom'
import type { Track, QueueItem } from '../types'

const host = ref<HTMLElement | null>(null)
const route = useRoute()
const router = useRouter()
const data = useData()
const { theme } = useTheme()
const failed = ref(false)
useVinylNoise() // a quiet crackle on the music while it plays in the room
useSpotify() // keeps records/iPod in the room up to date
loadGroups() // the shelf order may follow my folders
let api: ReturnType<typeof createRoom> | undefined

const ROUTES: Record<string, string> = { hjem: '/', japansk: '/japansk', gaming: '/gaming', lytte: '/lytte', ovelse: '/ovelse', gitar: '/gitar', boker: '/boker', reiser: '/reiser', kode: '/kode', om: '/om' }

let nextPeek: number | null = null // the record clicked on the way down to the shelf (pulled out first)
function onPick(p: PickEvent) {
  if (p.kind === 'station') { const to = ROUTES[p.station]; if (to) router.push(to); return }
  if (p.kind === 'stackrecord') {
    if (!p.album) return
    // a record from the stack: pick it up like one from the shelf (an album I don't have gets a guest record)
    if (!findAlbum(p.album.uri)) addGuest({ uri: p.album.uri, name: p.album.name ?? '', artist: p.album.artist ?? '', image: p.album.image, image_large: p.album.image_large })
    room.musicView = 'vinyl'
    room.sel.musikk = { kind: 'album', uri: p.album.uri, t: Date.now() }
    return
  }
  if (p.kind === 'turntable' || p.kind.startsWith('tt-')) {
    // the record player: first look at it from above; there the knobs and the tonearm are the buttons
    if (!room.deckView) { room.deckView = true; room.shelfView = false; room.sel.musikk = null; room.musicView = 'vinyl'; return }
    if (!spotify.now?.name || !admin.loggedIn) return
    if (p.kind === 'tt-prev') control('previous')
    else if (p.kind === 'tt-next') control('next')
    else control(spotify.now?.playing ? 'pause' : 'resume') // the start-stop knob, the tonearm, the record itself
    return
  }
  if (p.kind === 'guitar') room.sel.gitar = p.index ?? -1
  else if (p.kind === 'book') room.sel.bok = room.sel.bok === p.index ? -1 : p.index ?? -1
  else if (p.kind === 'country') { room.sel.land = room.sel.land === p.name ? null : p.name ?? null; if (room.sel.land) room.panelHidden = false } // picking a country always brings the panel (the trip) forward
  else if (p.kind === 'clock') toggleTimer()
  else if (p.kind === 'album') {
    room.musicView = 'vinyl'
    const take = () => { room.sel.musikk = { kind: 'album', uri: p.uri ?? '', t: Date.now() } }
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
  } else if (p.kind === 'anime') room.jpAnime = room.jpAnime === p.index ? -1 : p.index ?? -1
  else if (p.kind === 'ipod') room.musicView = 'ipod'
  else if (p.kind === 'screen') {
    const n = data.prosjekter?.length || 0
    if (n) room.sel.prosjekt = (room.sel.prosjekt + 1) % n
  } else if (p.kind === 'empty') {
    if (route.name === 'lytte' && room.deckView) { room.deckView = false; return }
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
    if (!host.value) return
    api = createRoom(host.value, {
      onPick,
      onHover: (h) => { room.hover = h; if (h?.uri) prefetchTracks(h.uri) },
      onReady: () => (room.ready = true),
      timerState,
      onDecorChange: (list) => decorChanged(list), // I moved / turned / resized one of my models
      onDecorSelect: (id) => (decor.selected = id),
    })
  } catch (e) {
    console.error(e)
    failed.value = true
    room.ready = true
    return
  }
  if (!api) return
  room.api = api
  if (import.meta.env.DEV) window.__room = api
  api.setTheme(theme.value)
  api.setWeather(weather.value)
  api.setCalm(calm.value)
  api.setTimerInterval(timer.interval)
  api.setMusic(sceneMusic())
  api.setStack(stackItems.value)
  api.setNext(nextAlbum.value)
  if (spotify.now?.uri) fetchTempo(spotify.now?.uri).then((b) => { if (api && spotify.now?.uri) api.setTempo(b) })
  if (data.loaded) api.setData(data)
  api.goTo(String(route.name || 'hjem'), { duration: 2.6 })
})

watch(() => data.version, () => data.loaded && api?.setData(data))
// the word of the day on the card in the Japanese corner
loadJapanese()
// the graphics settings (Innstillinger → Grafikk) go straight to the room
watch(() => [room.api, JSON.stringify(gfxPayload())], () => room.api?.setGraphics(gfxPayload()), { immediate: true })
// my own 3D models (Admin → Rom)
onMounted(loadDecor)
watch(() => [room.api, JSON.stringify(decor.items)], () => room.api?.setDecor(decor.items), { immediate: true })
watch(() => [room.api, decor.editing], () => room.api?.setDecorEdit(decor.editing), { immediate: true })
watch(() => [jp.word, room.api], () => room.api?.setJapanWord(jp.word), { immediate: true })
// the monitor in the gaming corner shows Steam
loadSteam()
watch(() => [steam.profile, steam.library, room.api], () => room.api?.setSteam({ profile: steam.profile, library: steam.library }), { immediate: true })
// …and the anime from the decks as DVDs stacked on the mat
watch(() => [jp.anime, room.jpAnime, room.api], () => room.api?.setAnime(jp.anime, room.jpAnime), { immediate: true })
watch(theme, (t) => api?.setTheme(t))
watch(() => weather.value?.kind, () => api?.setWeather(weather.value))
watch(calm, (v) => api?.setCalm(v))
watch(() => timer.interval, (v) => api?.setTimerInterval(v))
// the records stand in the shelf's order (by artist, or by my folders)
// the stack on the table: the albums coming up in the queue on top (next first), the ones I heard last below
const queuedTracks = ref<(Track | QueueItem)[]>([])
// the table shows what's coming: my own list first, then what Spotify itself has lined up
async function loadQueue() {
  const sp = spotify.connected && spotify.now?.name ? await fetchQueue() : []
  const mine = myQueue.items
  const sent = myQueue.sent?.uri
  queuedTracks.value = [...mine, ...sp.filter((t) => !(sent && t.uri === sent))]
}
watch(() => [spotify.now?.uri, spotify.queueV, spotify.connected, myQueue.items.length], loadQueue, { immediate: true })
// "next": an album is only next when ALL of it has been put in the queue (not just one song from it)
const nextAlbum = computed(() => {
  const ctx = String(spotify.now?.context || '')
  // the next ALBUM = the first run of songs (2 or more) that follow each other from the same album. A lone song is "from a playlist".
  const q = queuedTracks.value
  for (let i = 0; i < q.length; ) {
    let j = i + 1
    while (j < q.length && q[j].album_uri && q[j].album_uri === q[i].album_uri) j++
    const t = q[i]
    if (j - i >= 2 && t.album_uri && t.album_uri !== ctx && t.album !== spotify.now?.album) return { uri: t.album_uri, name: t.album, artist: 'album_artist' in t ? t.album_artist : t.artist, image: t.album_image, image_large: t.album_image, queued: true }
    i = j
  }
  return null
})
// the stack on the table: only the 3 albums I heard last (never the one that is on the turntable now)
const stackItems = computed(() => {
  const ctx = String(spotify.now?.context || '')
  const out = []
  for (const a of spotify.recent || []) {
    if (out.length >= 3) break
    if (a.uri === ctx || (spotify.now?.album && a.name === spotify.now?.album)) continue
    out.push({ ...a, queued: false })
  }
  return out
})
watch(nextAlbum, (v) => api?.setNext(v), { deep: false })
watch(() => [dailyAlbum.value?.uri, room.api], () => room.api?.setDaily(dailyAlbum.value?.uri), { immediate: true })
watch(stackItems, (v) => api?.setStack(v), { deep: false })
// the turntable spins to the tempo of the song (4 beats – one bar – per turn)
watch(() => spotify.now?.uri, async (uri) => {
  const bpm = uri ? await fetchTempo(uri) : 0
  if (spotify.now?.uri === uri) api?.setTempo(bpm)
}, { immediate: false })
const sceneMusic = () => ({ albums: shelfAlbums.value, playlists: spotify.playlists, now: spotify.now, guests: spotify.guests, playOn: playOn.value })
watch(() => [shelfAlbums.value, spotify.playlists, spotify.now, spotify.guests, playOn.value], () => api?.setMusic(sceneMusic()), { deep: false })
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
watch(() => [route.name, room.sel.musikk, room.musicView, room.panelHidden, room.shelfView, room.deckView, room.recordFlipped, room.peekIndex, shelfAlbums.value], () => {
  const here = route.name === 'lytte'
  api?.setMusicView({
    // the picked record is held up to the camera – not in the overhead view, where it lies by the turntable
    selected: here && room.musicView !== 'spiller' && room.sel.musikk?.kind === 'album' ? room.sel.musikk.uri : null,
    ipod: here && room.musicView === 'ipod',
    big: room.panelHidden || window.matchMedia('(max-width: 900px)').matches, // no panel (or a phone): the held iPod fills the screen
    // "Album": the camera stays by the turntable · "Spillelister": by the iPod on its stand
    // (picking something lifts the iPod up in front of the camera)
    pose: !here ? null : room.musicView.startsWith('ipod') ? 'ipod' : room.shelfView ? 'shelf' : room.deckView ? 'deck' : 'top',
    deck: here && room.deckView && !room.shelfView && !room.musicView.startsWith('ipod'),
    flip: room.recordFlipped,
    peek: here && room.shelfView && !room.sel.musikk && room.musicView === 'vinyl' ? shelfAlbums.value[room.peekIndex]?.uri || null : null,
  })
})
// started from this page: the side panel slides away and the camera settles on what's playing –
// a record goes onto the turntable ('spiller' = turntable camera, record not held up), a playlist
// puts the iPod back on its stand and the camera looks at it ('ipodDock'). Picking another record
// holds that one up; picking up the iPod (click it / the tab) takes it in hand again.
// the camera goes to the player the music belongs to: the turntable for an album, the iPod for a playlist or a found
// song (or what I've forced in the settings) – whenever a song begins, and after a while without anybody touching
// anything. The panel slides away on the PC so the player is the whole picture.
function focusPlayer(target?: 'ipod' | 'vinyl' | null) {
  if (route.name !== 'lytte') return
  room.musicView = (target || playOn.value) === 'ipod' ? 'ipodDock' : 'spiller'
  room.shelfView = false
  room.recordFlipped = false
  if (window.matchMedia('(min-width: 901px)').matches) room.panelHidden = true
}
watch(() => spotify.startedHere, () => focusPlayer(targetFor(spotify.origin?.uri, spotify.origin?.from)))
// a new song began (the next one in line, or started on another device): to the right player – unless I'm holding something
watch(() => spotify.now?.uri, (uri, old) => {
  if (!uri || uri === old || !spotify.now?.playing) return
  const holding = room.musicView === 'ipod' || (room.musicView === 'vinyl' && (room.sel.musikk || room.shelfView))
  if (!holding) focusPlayer()
})
let lastTouch = Date.now()
const touched = () => { lastTouch = Date.now() }
let idleTimer: ReturnType<typeof setInterval> | undefined
const onDeckKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && room.deckView) room.deckView = false }
onMounted(() => {
  window.addEventListener('keydown', onDeckKey)
  for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(e, touched, { passive: true })
  idleTimer = setInterval(() => {
    if (route.name !== 'lytte' || !spotify.now?.playing || Date.now() - lastTouch < 45000) return
    if (room.musicView !== 'spiller' && room.musicView !== 'ipodDock') focusPlayer()
  }, 5000)
})
onBeforeUnmount(() => { clearInterval(idleTimer); window.removeEventListener('keydown', onDeckKey); for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.removeEventListener(e, touched) })
watch(() => room.sel.musikk?.uri, (uri) => {
  room.recordFlipped = false
  if (uri && room.musicView === 'spiller') room.musicView = 'vinyl'
})
watch(() => route.name, (n) => {
  clearSelection()
  api?.goTo(String(n || 'hjem'))
})
watch(() => ({ ...room.sel }), (s) => api?.setSelection(s), { deep: true })

// the room's name tag belongs to the 3D view: drop it as soon as the pointer is over the panel or
// any other UI (the canvas doesn't always get a 'leave' when a panel slides in under a still pointer)
function onWindowMove(e: PointerEvent) {
  if (room.hover && targetEl(e).tagName !== 'CANVAS') room.hover = null
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
