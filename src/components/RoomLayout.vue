<script setup>
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Room from './Room.vue'
import LeaderLine from './LeaderLine.vue'
import MusicSwitch from './MusicSwitch.vue'
import IpodScreen from './IpodScreen.vue'
import RecordOverlay from './RecordOverlay.vue'
import MiniNowPlaying from './MiniNowPlaying.vue'
import MusicDrawer from './MusicDrawer.vue'
import SubTabs from './SubTabs.vue'
import BrandLogo from './BrandLogo.vue'
import { useData } from '../composables/useData'
import { room } from '../composables/useRoom'
import { spotify } from '../composables/useSpotify'
import { shell } from '../composables/useShell'
import { admin } from '../composables/useAdmin'

const data = useData()
const route = useRoute()
const router = useRouter()
const dock = ref(null)
const isHome = computed(() => route.name === 'hjem')
const isFocus = computed(() => route.name === 'ovelse' || route.name === 'admin')
const isWide = computed(() => route.name === 'admin' || (route.name === 'ovelse' && room.practiceTab === 'akkorder'))
// a selected country gets a wider panel so its photos can be scrolled comfortably
// once something is chosen, the panel grows to about half the screen and the 3D view steps back
const isExpanded = computed(() => {
  switch (route.name) {
    case 'reiser': return !!room.sel.land
    case 'gitar': return room.sel.gitar >= 0
    case 'boker': return room.sel.bok >= 0
    case 'lytte': return true // the record grid always gets the wide panel
    case 'japansk': return room.jpPractice // flashcards get the big panel
    default: return false
  }
})
const isMusic = computed(() => route.name === 'lytte')
// holding the iPod: the panel steps aside so the iPod has the stage
const holdingIpod = computed(() => isMusic.value && room.musicView === 'ipod')
const mobile = ref(window.matchMedia('(max-width: 900px)').matches)
const collapsed = ref(false)
// desktop: the side panel can be slid away so the 3D view (e.g. the held iPod) gets the whole screen.
// Only the listening corner remembers it – every other station opens with its panel showing.
const HIDE_KEY = 'niben-panel-hidden'
function hiddenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]')) } catch { return new Set() }
}
const canHide = computed(() => !mobile.value && !isHome.value && !isFocus.value)
const hidden = computed(() => canHide.value && room.panelHidden)
// panel away + music on: the little "now playing" box (top-right) is the way back, so no "Vis panel"
// little "now playing" top-right while music plays – everywhere in the room (not in the listening
// corner while its panel shows the full card, and not in the player app, which has its own bar)
const showMini = computed(() => (!!spotify.now?.name || (admin.loggedIn && isMusic.value)) && shell.value !== 'player' && !mobile.value && (hidden.value || route.name !== 'lytte'))
// a side panel on the right moves down below it
const belowMini = computed(() => showMini.value && !hidden.value && !isFocus.value && !isHome.value)
// the mini player opens the music panel on its own, on top of wherever you are (in the listening
// corner itself it just brings the side panel back)
const drawer = ref(false)
function openMini() {
  if (route.name === 'lytte') setHidden(false)
  else drawer.value = !drawer.value
}
watch(() => route.name, () => (drawer.value = false))
// top-right corner (the nav is a rail on the left, so nothing else is up there)
const miniTop = 20
function setHidden(v) {
  room.panelHidden = v
  const set = hiddenSet()
  if (route.name === 'lytte') v ? set.add('lytte') : set.delete('lytte')
  try { localStorage.setItem(HIDE_KEY, JSON.stringify([...set])) } catch {}
}
watch(() => route.name, (n) => (room.panelHidden = n === 'lytte' && hiddenSet().has(n)), { immediate: true })

// Tell the 3D view how much of the screen the panel covers,
// so the camera keeps its subject centred in the free space.
let ro
// width of the nav rail on the left (desktop), from the --rail CSS variable
const RAIL = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail')) || 0
const panelW = ref(0)
function measure() {
  if (dock.value && !hidden.value) panelW.value = dock.value.offsetWidth
  if (!room.api) return
  const el = dock.value
  if (!el) { room.api.setInsets({}); return }
  const r = el.getBoundingClientRect()
  if (isFocus.value) { room.api.setInsets({}); return }
  if (isHome.value) {
    room.api.setInsets(mobile.value ? { bottom: (window.innerHeight - r.top) * 0.8 } : { left: r.right * 0.4 })
    return
  }
  if (hidden.value) { room.api.setInsets({ left: mobile.value ? 0 : RAIL(), bottom: shell.value === 'player' ? 90 : 0 }); return }
  if (mobile.value) room.api.setInsets({ bottom: window.innerHeight - r.top })
  else room.api.setInsets({ left: RAIL(), right: hidden.value ? 0 : window.innerWidth - r.left, bottom: shell.value === 'player' ? 90 : 0 })
}
const mq = window.matchMedia('(max-width: 900px)')
const onMq = (e) => { mobile.value = e.matches; nextTick(measure) }

onMounted(() => {
  ro = new ResizeObserver(measure)
  ro.observe(dock.value)
  window.addEventListener('resize', measure)
  mq.addEventListener('change', onMq)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', measure)
  mq.removeEventListener('change', onMq)
})
watch(() => [route.name, room.api, collapsed.value, isExpanded.value, holdingIpod.value, hidden.value], () => nextTick(() => setTimeout(measure, 30)))
// the panel animates its width – keep the camera offset in sync while it does
watch(isExpanded, () => [150, 350, 600].forEach((t) => setTimeout(measure, t)))
watch(() => route.name, () => (collapsed.value = false))
</script>

<template>
  <Room />

  <transition name="loader">
    <div v-if="!room.ready || !data.loaded" class="loader">
      <BrandLogo mark class="loader-mark" />
      <div class="loader-bar"><span></span></div>
    </div>
  </transition>

  <LeaderLine :active="route.name === 'reiser' && !!room.sel.land" />
  <MusicSwitch v-if="isMusic && room.ready" />
  <!-- the other groups' sub-tabs: same look and spot as the music switch -->
  <SubTabs v-if="!isHome && !isMusic && room.ready" floating />
  <IpodScreen v-if="holdingIpod" />
  <RecordOverlay v-if="isMusic && room.musicView === 'vinyl'" />

  <transition name="fade">
    <div v-if="isFocus" class="focus-backdrop" aria-hidden="true"></div>
  </transition>

  <aside
    ref="dock"
    class="dock"
    :class="{ home: isHome, focus: isFocus, wide: isWide, expanded: isExpanded, big: isExpanded && route.name !== 'lytte', collapsed: collapsed && mobile && !isFocus, hidden }"
    :style="belowMini ? { top: `${miniTop + 62}px` } : null"
    :inert="hidden || undefined"
  >
    <button v-if="mobile && !isHome && !isFocus" class="grabber" @click="collapsed = !collapsed" :aria-label="collapsed ? 'Vis panel' : 'Skjul panel'">
      <span></span>
    </button>
    <router-view v-slot="{ Component, route: r }">
      <transition name="panel" mode="out-in" type="transition">
        <component :is="Component" :key="r.path" />
      </transition>
    </router-view>
  </aside>

  <!-- panel slid away: a tiny "now playing" in the top-right corner -->
  <MiniNowPlaying v-if="showMini && room.ready" :style="{ top: `${miniTop}px` }" @open="openMini" />
  <MusicDrawer v-if="drawer && showMini && room.ready" :style="{ top: `${miniTop + 62}px` }" @close="drawer = false" />

  <!-- desktop: slide the panel away / bring it back -->
  <button
    v-if="canHide && room.ready && !(hidden && showMini && isMusic)"
    class="hide-toggle glass"
    :class="{ out: hidden }"
    :style="hidden ? null : { right: `${panelW + 20 - 16}px` }"
    :aria-label="hidden ? 'Vis panelet' : 'Skjul panelet'"
    :title="hidden ? 'Vis panelet' : 'Skjul panelet'"
    @click="setHidden(!hidden)"
  >
    <ChevronLeft v-if="hidden" :size="20" aria-hidden="true" /><ChevronRight v-else :size="20" aria-hidden="true" /><b v-if="hidden">Vis panel</b>
  </button>
</template>

<style scoped>
.dock {
  position: fixed;
  z-index: 20;
  top: 20px;
  right: 20px;
  bottom: 20px;
  width: clamp(380px, 32vw, 500px);
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.dock > :deep(*) { pointer-events: auto; }
.dock { transition: width 0.55s var(--spring); }
.dock.expanded { width: clamp(410px, 50vw, 780px); }
.dock.hidden { transform: translateX(calc(100% + 40px)); opacity: 0; pointer-events: none; transition: transform 0.5s var(--spring), opacity 0.3s, width 0.55s var(--spring); }
.dock.hidden > :deep(*) { pointer-events: none; }
.hide-toggle {
  position: fixed;
  z-index: 21;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  min-width: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  color: var(--text-2);
  font: 600 0.85rem var(--font);
  cursor: pointer;
  transition: right 0.5s var(--spring), color 0.2s;
}
.hide-toggle span { font-size: 1.3rem; line-height: 1; }
.hide-toggle:hover { color: var(--accent); }
.hide-toggle.out { right: 16px; padding: 0 14px 0 12px; }
.dock.away { opacity: 0; transform: translateX(40px); pointer-events: none; transition: opacity 0.35s, transform 0.45s var(--ease); }
.dock.away > :deep(*) { pointer-events: none; }
.dock.home {
  top: auto;
  right: auto;
  left: calc(var(--rail) + 20px);
  bottom: 32px;
  width: min(560px, calc(100vw - 64px));
}

.dock.focus {
  top: 24px;
  bottom: 24px;
  left: calc(50% + var(--rail) / 2);
  right: auto;
  width: min(560px, calc(100vw - 32px));
  transform: translateX(-50%);
  justify-content: center;
}
.dock.focus.wide { width: min(880px, calc(100vw - 32px)); justify-content: flex-start; }
.focus-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--bg) 45%, transparent);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  backdrop-filter: blur(10px) saturate(120%);
}

.grabber {
  align-self: center;
  width: 64px;
  height: 22px;
  border: 0;
  background: transparent;
  display: grid;
  place-items: center;
  cursor: pointer;
  margin-bottom: -4px;
  pointer-events: auto;
}
.grabber span {
  width: 42px;
  height: 5px;
  border-radius: 99px;
  background: var(--glass-strong);
  box-shadow: var(--shadow-1);
}

@media (max-width: 900px) {
  .dock {
    top: auto;
    left: 10px;
    right: 10px;
    bottom: calc(84px + env(safe-area-inset-bottom));
    width: auto;
    max-height: 46dvh;
    transition: transform 0.5s var(--spring);
  }
  /* something chosen (a country, a guitar, a book …; not the music corner, which is always "expanded"): the sheet takes most of the screen and the
     room shrinks to a strip above it; the header gets compact so the content has room */
  .dock.expanded { width: auto; }
  .dock.big { max-height: 74dvh; }
  .dock.big :deep(.panel-head) { padding: 10px 18px 4px; }
  .dock.big :deep(.panel-head .eyebrow),
  .dock.big :deep(.panel-head p) { display: none; }
  .dock.big :deep(.panel-head h2) { font-size: 1.25rem; }
  .dock.collapsed { transform: translateY(calc(100% - 60px)); }
  .dock.focus {
    top: 70px;
    left: 50%;
    right: auto;
    bottom: calc(86px + env(safe-area-inset-bottom));
    width: calc(100vw - 20px);
    max-height: none;
    transform: translateX(-50%);
  }
  .dock.home {
    left: 14px;
    right: 14px;
    bottom: calc(92px + env(safe-area-inset-bottom));
    width: auto;
  }
}

.loader {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 22px;
  background: var(--bg);
}
.loader-mark {
  height: 84px;
  filter: drop-shadow(0 12px 28px var(--accent-glow));
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe { 50% { transform: scale(1.08) rotate(-4deg); } }
.loader-bar {
  width: 140px;
  height: 4px;
  border-radius: 9px;
  background: var(--accent-soft);
  overflow: hidden;
}
.loader-bar span {
  display: block;
  height: 100%;
  width: 40%;
  border-radius: 9px;
  background: var(--accent);
  animation: slide 1.1s var(--ease) infinite;
}
@keyframes slide { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
.loader-leave-active { transition: opacity 0.8s var(--ease), filter 0.8s var(--ease); }
.loader-leave-to { opacity: 0; filter: blur(12px); }


</style>
