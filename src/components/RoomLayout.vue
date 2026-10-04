<script setup>
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Room from './Room.vue'
import LeaderLine from './LeaderLine.vue'
import MusicSwitch from './MusicSwitch.vue'
import IpodScreen from './IpodScreen.vue'
import RecordOverlay from './RecordOverlay.vue'
import MiniNowPlaying from './MiniNowPlaying.vue'
import BrandLogo from './BrandLogo.vue'
import { useData } from '../composables/useData'
import { room } from '../composables/useRoom'
import { spotify } from '../composables/useSpotify'
import { shell } from '../composables/useShell'

const data = useData()
const route = useRoute()
const dock = ref(null)
const isHome = computed(() => route.name === 'hjem')
const isFocus = computed(() => route.name === 'ovelse' || route.name === 'admin')
const isWide = computed(() => route.name === 'admin')
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
// Remembered per station.
const HIDE_KEY = 'niben-panel-hidden'
function hiddenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]')) } catch { return new Set() }
}
const canHide = computed(() => !mobile.value && !isHome.value && !isFocus.value)
const hidden = computed(() => canHide.value && room.panelHidden)
// panel away + music on: the little "now playing" box (top-right) is the way back, so no "Vis panel"
const showMini = computed(() => hidden.value && !!spotify.now?.name && shell.value !== 'player') // the player app has its bar
// top-right corner, unless the nav row reaches that far – then one row down
const miniTop = computed(() => (navRight.value + 16 + 250 > window.innerWidth - 20 ? 84 : 20))
function setHidden(v) {
  room.panelHidden = v
  const set = hiddenSet()
  v ? set.add(route.name) : set.delete(route.name)
  try { localStorage.setItem(HIDE_KEY, JSON.stringify([...set])) } catch {}
}
watch(() => route.name, (n) => (room.panelHidden = hiddenSet().has(n)), { immediate: true })
// the panel may use the full height when the nav row (top-left) doesn't reach it
const tall = ref(false)
const navRight = ref(0)
function checkTall() {
  const items = [...document.querySelectorAll('.nav-wrap > *')]
  const el = dock.value
  if (items.length) navRight.value = Math.max(...items.map((n) => n.getBoundingClientRect().right))
  if (!items.length || !el || mobile.value) { tall.value = false; return }
  const panelLeft = window.innerWidth - 20 - el.offsetWidth
  navRight.value = Math.max(...items.map((n) => n.getBoundingClientRect().right))
  tall.value = navRight.value + 16 < panelLeft
}

// Tell the 3D view how much of the screen the panel covers,
// so the camera keeps its subject centred in the free space.
let ro
const panelW = ref(0)
function measure() {
  checkTall()
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
  if (hidden.value) { room.api.setInsets({ bottom: shell.value === 'player' ? 90 : 0 }); return }
  if (mobile.value) room.api.setInsets({ bottom: window.innerHeight - r.top })
  else room.api.setInsets({ right: hidden.value ? 0 : window.innerWidth - r.left, bottom: shell.value === 'player' ? 90 : 0 })
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
  <IpodScreen v-if="holdingIpod" />
  <RecordOverlay v-if="isMusic && room.musicView === 'vinyl'" />

  <transition name="fade">
    <div v-if="isFocus" class="focus-backdrop" aria-hidden="true"></div>
  </transition>

  <aside
    ref="dock"
    class="dock"
    :class="{ tall, home: isHome, focus: isFocus, wide: isWide, expanded: isExpanded, collapsed: collapsed && mobile && !isFocus, hidden }"
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
  <MiniNowPlaying v-if="showMini && room.ready" :style="{ top: `${miniTop}px` }" @open="setHidden(false)" />

  <!-- desktop: slide the panel away / bring it back -->
  <button
    v-if="canHide && room.ready && !showMini"
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
  top: 96px;
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
  left: 32px;
  bottom: 32px;
  width: min(560px, calc(100vw - 64px));
}

.dock.focus {
  top: 92px;
  bottom: 24px;
  left: 50%;
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

/* wide screens: the nav sits top-left, so the panel can use the full height on the right */
.dock.tall:not(.focus):not(.home) { top: 20px; }
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
  .dock.expanded { width: auto; }
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
