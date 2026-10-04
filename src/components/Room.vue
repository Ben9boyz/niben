<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRoom } from '../three/room'
import { room, clearSelection } from '../composables/useRoom'
import { useData } from '../composables/useData'
import { useTheme } from '../composables/useTheme'
import { timer, timerState, toggle as toggleTimer } from '../composables/useTimer'
import { spotify, useSpotify, prefetchTracks } from '../composables/useSpotify'
import { jp, loadJapanese } from '../composables/useJapanese'

const host = ref(null)
const route = useRoute()
const router = useRouter()
const data = useData()
const { theme } = useTheme()
const failed = ref(false)
useSpotify() // keeps records/iPod in the room up to date
let api

const ROUTES = { hjem: '/', japansk: '/japansk', lytte: '/lytte', ovelse: '/ovelse', gitar: '/gitar', boker: '/boker', reiser: '/reiser', kode: '/kode', om: '/om' }

function onPick(p) {
  if (p.kind === 'station') { router.push(ROUTES[p.station]); return }
  if (p.kind === 'guitar') room.sel.gitar = p.index
  else if (p.kind === 'book') room.sel.bok = room.sel.bok === p.index ? -1 : p.index
  else if (p.kind === 'country') room.sel.land = room.sel.land === p.name ? null : p.name
  else if (p.kind === 'clock') toggleTimer()
  else if (p.kind === 'album') {
    room.musicView = 'vinyl'
    room.sel.musikk = room.sel.musikk?.uri === p.uri ? null : { kind: 'album', uri: p.uri, t: Date.now() }
  } else if (p.kind === 'ipod') room.musicView = 'ipod'
  else if (p.kind === 'screen') {
    const n = data.prosjekter?.length || 0
    if (n) room.sel.prosjekt = (room.sel.prosjekt + 1) % n
  } else if (p.kind === 'empty') {
    if (route.name === 'lytte') { room.sel.musikk = null; room.musicView = 'vinyl' }
    room.sel.bok = -1
    room.sel.land = null
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
  api.setMusic(spotify)
  if (data.loaded) api.setData(data)
  api.goTo(route.name || 'hjem', { duration: 2.6 })
})

watch(() => data.version, () => data.loaded && api?.setData(data))
// the word of the day on the card in the Japanese corner
loadJapanese()
watch(() => [jp.word, room.api], () => room.api?.setJapanWord(jp.word), { immediate: true })
watch(theme, (t) => api?.setTheme(t))
watch(() => timer.interval, (v) => api?.setTimerInterval(v))
watch(() => [spotify.albums, spotify.playlists, spotify.now], () => api?.setMusic(spotify), { deep: false })
watch(() => [route.name, room.sel.musikk, room.musicView, room.panelHidden], () => {
  const here = route.name === 'lytte'
  api?.setMusicView({
    // the picked record is held up to the camera – not in the overhead view, where it lies by the turntable
    selected: here && room.musicView !== 'spiller' && room.sel.musikk?.kind === 'album' ? room.sel.musikk.uri : null,
    ipod: here && room.musicView === 'ipod',
    big: room.panelHidden, // no panel: the held iPod can fill much more of the screen
    // "Vinyler": the camera stays by the turntable · "Spillelister": by the iPod on its stand
    // (picking something lifts the iPod up in front of the camera)
    pose: !here ? null : room.musicView.startsWith('ipod') ? 'ipod' : 'top',
  })
})
// started from this page: the side panel slides away and the camera settles on what's playing –
// a record goes onto the turntable ('spiller' = turntable camera, record not held up), a playlist
// puts the iPod back on its stand and the camera looks at it ('ipodDock'). Picking another record
// holds that one up; picking up the iPod (click it / the tab) takes it in hand again.
watch(() => spotify.startedHere, () => {
  if (route.name !== 'lytte') return
  room.musicView = room.musicView.startsWith('ipod') ? 'ipodDock' : 'spiller'
  if (window.matchMedia('(min-width: 901px)').matches) room.panelHidden = true
})
watch(() => room.sel.musikk?.uri, (uri) => {
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
