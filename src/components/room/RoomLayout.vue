<script setup lang="ts">
import { ChevronRight, PanelRightOpen, ChevronDown, PanelBottomOpen } from 'lucide-vue-next'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Room from './Room.vue'
import LeaderLine from './LeaderLine.vue'
import IpodScreen from '@/components/vinyl/IpodScreen.vue'
import RecordOverlay from '@/components/vinyl/RecordOverlay.vue'
import SubTabs from '@/components/layout/SubTabs.vue'
import DecorEditor from './DecorEditor.vue'
import { decor } from '@/composables/room/useDecor'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import { useData } from '@/composables/site/useData'
import { room } from '@/composables/room/useRoom'
import { spotify } from '@/composables/music/useSpotify'
import { shell } from '@/composables/ui/useShell'
import GlobalMini from '@/components/music/GlobalMini.vue'
import MusicSwitch from '@/components/music/MusicSwitch.vue'
import ListenDock from '@/components/vinyl/ListenDock.vue'
import TourCard from '@/components/layout/TourCard.vue'
import { admin } from '@/composables/site/useAdmin'
import { shelfAlbums } from '@/composables/music/useGroups'

const data = useData()
const route = useRoute()
const router = useRouter()
const dock = ref<HTMLElement | null>(null)
const isHome = computed(() => route.name === 'hjem')
const isFocus = computed(() => (route.name === 'ovelse' || route.name === 'admin') && !decor.editing) // (editing the room: the room itself must be sharp)
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
// at the iPod: the panel steps aside so the iPod has the stage
const usingIpod = computed(() => isMusic.value && room.musicView === 'ipod')
const mobile = ref(window.matchMedia('(max-width: 900px)').matches)
const collapsed = ref(false)
// desktop: the side panel can be slid away so the 3D view (e.g. the held iPod) gets the whole screen.
// Only the listening corner remembers it – every other station opens with its panel showing.
const HIDE_KEY = 'niben-panel-hidden'
function hiddenSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]') as string[]) } catch { return new Set() }
}
const canHide = computed(() => !mobile.value && !isHome.value && !isFocus.value)
const hidden = computed(() => canHide.value && room.panelHidden)
// the little player in the top-right corner (GlobalMini): everywhere in the room except the listening corner while
// its panel shows the full player. A side panel on the right then moves down below it.
const miniOn = computed(() => !(mobile.value && isMusic.value) && (!!spotify.now?.name || admin.mine) && shell.value !== 'player' && route.name !== 'admin' && (route.name !== 'lytte' || hidden.value) && (!mobile.value || collapsed.value))
// phones in the listening corner: no side menus – one tiny switch (Album / Spillelister) on top and ONE action bar at the bottom (ListenDock)
const listenPhone = computed(() => mobile.value && isMusic.value)
watch(listenPhone, (v) => document.documentElement.classList.toggle('listen-phone', v), { immediate: true })
// phones: a record that comes out of the shelf is at once held up close to the camera (no half-way "peek" to tap again);
// the arrows (and a swipe) then flick through the shelf with each record up close
watch(() => [listenPhone.value, room.shelfView, room.musicView] as const, async ([phoneListen, onShelf, view]) => {
  if (!phoneListen || !onShelf || view !== 'vinyl' || room.sel.musikk) return
  await nextTick() // (Room.vue picks which record comes out first)
  const a = shelfAlbums.value[room.peekIndex]
  if (a && room.shelfView && !room.sel.musikk) room.sel.musikk = { kind: 'album', uri: a.uri, t: Date.now() }
}, { immediate: true })
onBeforeUnmount(() => document.documentElement.classList.remove('listen-phone'))
const belowMini = computed(() => miniOn.value && !mobile.value && !hidden.value && !isFocus.value && !isHome.value)
function setHidden(v: boolean) {
  room.panelHidden = v
  const set = hiddenSet()
  if (route.name === 'lytte') v ? set.add('lytte') : set.delete('lytte')
  try { localStorage.setItem(HIDE_KEY, JSON.stringify([...set])) } catch {}
}
// phones: picking up the iPod slides the sheet away so the iPod fills the screen (the arrow brings the panel back)
watch(usingIpod, (v) => { if (v && mobile.value) collapsed.value = true })
// phones, the listening corner: the record player is the stage. The library (Album / Spillelister) is a sheet you pull up
// with the switch at the top – and picking a record puts the sheet away so the record comes forward
watch(() => route.name, (n) => { if (mobile.value && n === 'lytte') collapsed.value = true }, { immediate: true })
watch(() => room.sel.musikk, (v) => { if (v && mobile.value) collapsed.value = true })
watch(() => route.name, (n) => (room.panelHidden = n === 'lytte' && hiddenSet().has(n)), { immediate: true })

// Tell the 3D view how much of the screen the panel covers,
// so the camera keeps its subject centred in the free space.
let ro: ResizeObserver | undefined
// width of the nav rail on the left (desktop), from the --rail CSS variable
const RAIL = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail')) || 0
const panelW = ref(0)
// the hide / show button sits at the vertical middle of the panel that is actually showing (it is often shorter than the screen)
const toggleTop = ref<number | null>(null)
function placeToggle() {
  const el = dock.value?.querySelector(':scope > .panel, :scope > section, :scope > div:not(.grabber)')
  if (!el || hidden.value) { toggleTop.value = null; return }
  const r = el.getBoundingClientRect()
  toggleTop.value = r.height > 20 ? Math.round(r.top + r.height / 2) : null
}
let toggleTimer: ReturnType<typeof setInterval> | undefined
function measure() {
  if (dock.value && !hidden.value) panelW.value = dock.value.offsetWidth
  if (!room.api) return
  const el = dock.value
  if (!el) { room.api.setInsets({}); return }
  const r = el.getBoundingClientRect()
  if (isFocus.value || decor.editing) { room.api.setInsets({}); return }
  if (isHome.value) {
    room.api.setInsets(mobile.value ? { bottom: (window.innerHeight - r.top) * 0.8 } : { left: r.right * 0.4 })
    return
  }
  if (hidden.value) { room.api.setInsets({ left: mobile.value ? 0 : RAIL(), bottom: shell.value === 'player' ? 90 : 0 }); return }
  if (mobile.value && collapsed.value) { room.api.setInsets({ bottom: 90 }); return }
  if (mobile.value) room.api.setInsets({ bottom: Math.min(window.innerHeight - r.top, window.innerHeight * 0.5) })
  else room.api.setInsets({ left: RAIL(), right: hidden.value ? 0 : window.innerWidth - r.left, bottom: shell.value === 'player' ? 90 : 0 })
}
const mq = window.matchMedia('(max-width: 900px)')
const onMq = (e: MediaQueryListEvent) => { mobile.value = e.matches; nextTick(measure) }

onMounted(() => {
  toggleTimer = setInterval(placeToggle, 250)
  ro = new ResizeObserver(measure)
  if (dock.value) ro.observe(dock.value)
  window.addEventListener('resize', measure)
  mq.addEventListener('change', onMq)
})
onBeforeUnmount(() => {
  clearInterval(toggleTimer)
  ro?.disconnect()
  window.removeEventListener('resize', measure)
  mq.removeEventListener('change', onMq)
})
watch(() => [route.name, room.api, collapsed.value, isExpanded.value, usingIpod.value, hidden.value, decor.editing], () => nextTick(() => setTimeout(measure, 30)))
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
  <!-- the other groups' sub-tabs: same look and spot as the music switch -->
  <SubTabs v-if="!isHome && !isMusic && room.ready" floating />
  <IpodScreen v-if="usingIpod" />
  <RecordOverlay v-if="isMusic && room.musicView === 'vinyl'" />

  <transition name="fade">
    <div v-if="isFocus" class="focus-backdrop" aria-hidden="true"></div>
  </transition>

  <aside
    ref="dock"
    class="dock"
    :class="{ home: isHome, focus: isFocus, wide: isWide, expanded: isExpanded, big: isExpanded && route.name !== 'lytte', collapsed: collapsed && mobile && !isFocus, hidden }"
    :style="belowMini ? { top: '86px' } : undefined"
    :inert="hidden || undefined"
    v-show="!decor.editing"
  >
    <!-- phones: the panel fills the screen like the flat version; this closes it so only the 3D room is left -->
    <button v-if="mobile && !isHome && !isFocus" class="close-sheet glass" aria-label="Lukk panelet – se rommet" title="Se rommet" @click="collapsed = true">
      <ChevronDown :size="20" aria-hidden="true" />
    </button>
    <router-view v-slot="{ Component, route: r }">
      <transition name="panel" mode="out-in" type="transition">
        <component :is="Component" :key="r.path" />
      </transition>
    </router-view>
  </aside>

  <DecorEditor />
  <MusicSwitch v-if="isMusic && room.ready" @pick="collapsed = false" />
  <ListenDock v-if="listenPhone && room.ready && collapsed && !decor.editing" />
  <GlobalMini :show="miniOn" />
  <TourCard v-if="room.ready" />

  <!-- phones, panel closed: one icon brings it back -->
  <button v-if="mobile && collapsed && !isHome && !isFocus && room.ready" class="open-fab glass" aria-label="Åpne panelet" title="Åpne panelet" @click="collapsed = false">
    <PanelBottomOpen :size="22" aria-hidden="true" />
  </button>

  <!-- desktop: slide the panel away / bring it back -->
  <button
    v-if="canHide && room.ready"
    class="hide-toggle glass"
    :class="{ out: hidden }"
    :style="[hidden ? null : { right: `${panelW + 20 - 16}px` }, toggleTop != null ? { top: `${toggleTop}px` } : undefined]"
    :aria-label="hidden ? 'Vis panelet' : 'Skjul panelet'"
    :title="hidden ? 'Vis panelet' : 'Skjul panelet'"
    @click="setHidden(!hidden)"
  >
    <PanelRightOpen v-if="hidden" :size="20" aria-hidden="true" /><ChevronRight v-else :size="20" aria-hidden="true" />
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
  transition: right 0.5s var(--spring), top 0.35s var(--ease, ease), color 0.2s;
}
.hide-toggle span { font-size: 1.3rem; line-height: 1; }
.hide-toggle:hover { color: var(--accent); }
.hide-toggle.out { right: 16px; width: 44px; justify-content: center; padding: 0; }
.dock.away { opacity: 0; transform: translateX(40px); pointer-events: none; transition: opacity 0.35s, transform 0.45s var(--ease); }
.dock.away > :deep(*) { pointer-events: none; }
.dock.home {
  top: auto;
  right: auto;
  left: calc(var(--rail) + 20px);
  bottom: 32px;
  width: min(880px, calc(100vw - var(--rail) - 64px)); /* wide: more of "Akkurat nå" at once */
}

.dock.focus {
  top: 84px; /* below the floating sub-tabs (Japansk / Gitar-øving), which would otherwise sit on top of the panel on narrower windows */
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

.close-sheet, .open-fab { display: none; }
@media (max-width: 900px) { .close-sheet, .open-fab { display: grid; } }
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
  /* phones: an open panel takes (nearly) the whole screen, like the flat version – close it with the arrow and
     only the 3D room is left, with one icon to open the panel again */
  .dock {
    top: calc(62px + env(safe-area-inset-top));
    left: 10px;
    right: 10px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    width: auto;
    max-height: none;
    transition: transform 0.5s var(--spring), opacity 0.3s;
  }
  .dock.expanded { width: auto; }
  .dock.big :deep(.panel-head) { padding: 10px 18px 4px; }
  .dock.big :deep(.panel-head .eyebrow),
  .dock.big :deep(.panel-head p) { display: none; }
  .dock.big :deep(.panel-head h2) { font-size: 1.25rem; }
  .dock:not(.home):not(.focus) > :deep(.panel) { flex: 1 1 auto; min-height: 0; max-height: none; }
  .dock.collapsed { transform: translateY(calc(100% + 120px)); opacity: 0; pointer-events: none; }
  .dock.collapsed > :deep(*) { pointer-events: none; }
  .close-sheet {
    align-self: flex-end;
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin: 0 4px 6px 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: var(--text-2);
    cursor: pointer;
    pointer-events: auto;
  }
  .open-fab {
    position: fixed;
    z-index: 21;
    right: 14px;
    bottom: calc(22px + env(safe-area-inset-bottom));
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: var(--accent);
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);
    cursor: pointer;
  }
  .dock.focus {
    top: 126px; /* under the nav bar and the floating sub-tabs (Japansk / Gitar-øving) */
    left: 50%;
    right: auto;
    bottom: calc(14px + env(safe-area-inset-bottom));
    width: calc(100vw - 20px);
    max-height: none;
    transform: translateX(-50%);
  }
  .dock.home {
    left: 14px;
    right: 14px;
    bottom: calc(14px + env(safe-area-inset-bottom));
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

<style>
/* phones in the 3D listening corner: nothing but the tiny Album / Spillelister switch on top and the action bar at the bottom
   (the menu, the settings cog, the mini player, the panel button and the room's own record buttons are all out of the way –
   the plain version has everything, and the "2D" button next to the switch goes there) */
html.listen-phone .mbar, html.listen-phone .mlogo, html.listen-phone .nav, html.listen-phone body .sm.sm, html.listen-phone .open-fab,
html.listen-phone .rplay, html.listen-phone .rflip, html.listen-phone .rclose, html.listen-phone .shelfbar { display: none !important; }
</style>

