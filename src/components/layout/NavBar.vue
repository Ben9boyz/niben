<script setup lang="ts">
import SettingsMenu from './SettingsMenu.vue'
import ViewSwitch from './ViewSwitch.vue'
import ProfileMenu from './ProfileMenu.vue'
import HallDoor from './HallDoor.vue'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, type Component, type ComponentPublicInstance } from 'vue'
import { navGroups, groupOf, groupTarget, tabLabel, tabTarget, routeKey, tabIcon } from '@/lib/nav'
import { iconOf } from '@/lib/icons'
import { useRoute, useRouter } from 'vue-router'
import { admin, checkLogin } from '@/composables/site/useAdmin'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import { Menu, X, Footprints, Disc3, Library, Smartphone } from 'lucide-vue-next'
import { room } from '@/composables/room/useRoom'
import { targetEl } from '@/lib/dom'
import { mode } from '@/composables/ui/useMode'

const route = useRoute()
const router = useRouter()

// Hidden way into the admin page: double-click (or long-press) the logo
let pressTimer: ReturnType<typeof setTimeout> | undefined
function toAdmin() { router.push('/admin') }
function pressStart(e: PointerEvent) {
  if (e.pointerType !== 'touch') return
  pressTimer = setTimeout(toAdmin, 600)
}
function pressEnd() { clearTimeout(pressTimer) }

// the menu shows the main tabs; the sub-tabs are pills inside the page (SubTabs). A tab opens the
// sub-tab you were last on.
const links = computed(() => navGroups.value.map((g) => ({ name: g.id, label: g.label, icon: g.icon, glyph: g.glyph, to: groupTarget(g), routes: g.routes })))
const activeGroup = computed(() => groupOf(routeKey(route))?.id)
// phones (plain version): a top bar with the page's name – the group (its sub-tabs sit just below)
const barTitle = computed(() => (route.name === 'hjem' ? '' : route.name === 'admin' ? 'Admin' : groupOf(routeKey(route))?.label || route.meta?.title || ''))

const track = ref<HTMLElement | null>(null)
const itemEls = ref<HTMLElement[]>([])
function setItem(i: number, el: Element | ComponentPublicInstance | null) {
  const node = el instanceof Element ? el : el?.$el
  if (node instanceof HTMLElement) itemEls.value[i] = node
}
const drop = ref({ x: 0, y: 0, w: 0, h: 0, ready: false })
const rail = window.matchMedia('(min-width: 721px)')
const stretching = ref(false)
// phones: the menu is one small button that opens the bar (it closes again after you pick something) – the screen stays free
const isPhone = ref(window.matchMedia('(max-width: 720px)').matches)
const phoneMq = window.matchMedia('(max-width: 720px)')
const onPhoneMq = () => { isPhone.value = phoneMq.matches }
const navOpen = ref(false)
const activeIcon = computed(() => links.value.find((l) => l.name === activeGroup.value)?.icon || 'M4 6h16M4 12h16M4 18h16')
const closeNav = () => { navOpen.value = false }
const onNavDoc = (e: Event) => { if (navOpen.value && !targetEl(e).closest('.nav-wrap')) closeNav() }
const onNavKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeNav() }
const scrolled = ref(false)

function place() {
  const idx = links.value.findIndex((l) => l.name === activeGroup.value)
  const el = itemEls.value[idx]
  if (!el || !track.value) return
  const prev = drop.value.x + drop.value.y
  drop.value = rail.matches
    ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, ready: true }
    : { x: el.offsetLeft, y: 0, w: el.offsetWidth, h: 0, ready: true }
  if (prev !== drop.value.x + drop.value.y) {
    stretching.value = true
    setTimeout(() => (stretching.value = false), 260)
  }
}

watch(activeGroup, () => nextTick(place))
watch(() => route.fullPath, () => { setHidden(false); closeNav() })
const phone = window.matchMedia('(max-width: 720px)')
let lastY = 0
function setHidden(v: boolean) { document.documentElement.classList.toggle('nav-hidden', v) }
function onScroll() {
  const y = window.scrollY
  scrolled.value = y > 12
  if (!phone.matches) return setHidden(false)
  // down = out of the way (the page is what you're reading); up, or back at the top = back
  if (y > lastY + 10 && y > 90) setHidden(true)
  else if (y < lastY - 6 || y < 40) setHidden(false)
  lastY = y
}
// ── The sub-tabs pop out of the main tab (desktop, where there is a pointer to hover with) ──
// Hover "Lære" and Japansk / Gitar-øving fan out beside it; pick one and the pills fly up to where the sub-tabs sit on the page.
const canHover = window.matchMedia('(hover: hover) and (min-width: 721px)')
interface FlyItem { id: string; label: string; icon?: string | Component; view?: 'now' | 'shelf' | 'ipod' }
const fly = ref<{ name: string; top: number; left: number; items: FlyItem[] } | null>(null)
// what pops out of a tab: the sub-tabs of its group – and for Lytte (one page) the three ways to look at the corner
const LYTTE_VIEWS: FlyItem[] = [{ id: 'now', label: 'Spiller nå', icon: Disc3, view: 'now' }, { id: 'shelf', label: 'Hylle', icon: Library, view: 'shelf' }, { id: 'ipod', label: 'iPod', icon: Smartphone, view: 'ipod' }]
function flyItems(name: string, routes: string[]): FlyItem[] {
  if (name === 'lytte') return mode.value === 'rom' ? LYTTE_VIEWS : []
  return routes.length > 1 ? routes.map((r) => ({ id: r, label: tabLabel(r), icon: tabIcon(r) })) : []
}
const flyEl = ref<HTMLElement | null>(null)
let flyTimer: ReturnType<typeof setTimeout> | undefined
function openFly(name: string, routes: string[], e: Event) {
  clearTimeout(flyTimer)
  const items = flyItems(name, routes)
  if (!canHover.matches || !items.length) { fly.value = null; return }
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  fly.value = { name, top: r.top + r.height / 2, left: r.right + 10, items }
}
const closeFlySoon = () => { clearTimeout(flyTimer); flyTimer = setTimeout(() => (fly.value = null), 260) }
const keepFly = () => clearTimeout(flyTimer)
const raf = () => new Promise<void>((res) => requestAnimationFrame(() => res()))
function lookAtCorner(v: NonNullable<FlyItem['view']>) {
  room.discover = false; room.deckView = false; room.sel.musikk = null
  room.shelfView = v === 'shelf'
  room.musicView = v === 'ipod' ? 'ipod' : v === 'shelf' ? 'vinyl' : 'spiller'
}
async function pickFly(it: FlyItem) {
  const root = flyEl.value
  const isView = !!it.view
  const go = async () => { await router.push(isView ? { name: 'lytte' } : tabTarget(it.id)).catch(() => undefined); if (it.view) { await nextTick(); lookAtCorner(it.view) } }
  if (!root) { void go(); return }
  const pills = [...root.querySelectorAll<HTMLElement>('button.fp')]
  const from = pills.map((p) => p.getBoundingClientRect())
  const clones = pills.map((p, i) => {
    const c = p.cloneNode(true) as HTMLElement
    c.classList.add('fp-fly')
    Object.assign(c.style, { position: 'fixed', margin: '0', left: `${from[i].left}px`, top: `${from[i].top}px`, width: `${from[i].width}px`, height: `${from[i].height}px`, animation: 'none', zIndex: '60', pointerEvents: 'none', transformOrigin: '0 0' })
    document.body.appendChild(c)
    return c
  })
  clearTimeout(flyTimer)
  fly.value = null
  document.documentElement.classList.add('flying') // (the real sub-tab pill waits, still, until the pills have landed)
  await go()
  await nextTick(); await raf(); await raf()
  const targets = [...document.querySelectorAll<HTMLElement>(isView ? '.msw .cam button' : '[aria-label="Underfaner"] [role="tab"]')]
  const done = () => { clones.forEach((c) => c.remove()); document.documentElement.classList.remove('flying') }
  if (targets.length !== clones.length) return done()
  const anims = clones.map((c, i) => {
    const t = targets[i].getBoundingClientRect()
    const dx = t.left - from[i].left, dy = t.top - from[i].top
    const sx = t.width / from[i].width, sy = t.height / from[i].height
    return c.animate(
      [{ transform: 'translate(0, 0) scale(1, 1)', opacity: 1 }, { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 26}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2}) rotate(${i % 2 ? 4 : -4}deg)`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.9 }],
      { duration: 640, delay: i * 70, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)', fill: 'both' },
    ).finished
  })
  await Promise.all(anims).catch(() => undefined)
  done()
}

onMounted(() => {
  nextTick(place)
  document.fonts?.ready.then(place)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('pointerdown', onNavDoc)
  phoneMq.addEventListener('change', onPhoneMq)
  window.addEventListener('keydown', onNavKey)
  checkLogin()
})
onBeforeUnmount(() => {
  setHidden(false)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('pointerdown', onNavDoc)
  phoneMq.removeEventListener('change', onPhoneMq)
  window.removeEventListener('keydown', onNavKey)
})
</script>

<template>
  <!-- phones, plain version: the bar behind the page name and the buttons on the right -->
  <div class="mtop" :class="{ scrolled }" aria-hidden="true">
    <b v-if="barTitle">{{ barTitle }}</b>
  </div>
  <header class="nav-wrap" :class="{ scrolled }">
    <router-link
      to="/"
      class="brand glass"
      aria-label="niben – hjem"
      @dblclick.prevent="toAdmin"
      @pointerdown="pressStart"
      @pointerup="pressEnd"
      @pointerleave="pressEnd"
      @contextmenu="(e) => e.pointerType === 'touch' && e.preventDefault()"
    >
      <BrandLogo class="logo-full" />
      <BrandLogo mark class="logo-mark" />
    </router-link>

    <!-- me: the room you are in (and the way between rooms) sits at the top of the rail, above Hjem -->
    <ProfileMenu v-if="!isPhone" />

    <nav class="nav glass" :class="{ open: navOpen }" ref="track">
      <span
        class="drop"
        :class="{ ready: drop.ready, stretch: stretching }"
        :style="{ transform: `translate(${drop.x}px, ${drop.y}px)`, width: `${drop.w}px`, height: drop.h ? `${drop.h}px` : undefined }"
      ></span>
      <router-link
        v-for="(l, i) in links"
        :key="l.name"
        :to="l.to"
        class="item"
        :class="{ active: activeGroup === l.name }"
        :ref="(el) => setItem(i, el)"
        @mouseenter="openFly(l.name, l.routes, $event)"
        @mouseleave="closeFlySoon"
        @focus="openFly(l.name, l.routes, $event)"
      >
        <component :is="iconOf(l.glyph)" v-if="l.glyph" :size="20" aria-hidden="true" />
        <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="l.icon" /></svg>
        <span class="label">{{ l.label }}</span>
        <span class="tip">{{ l.label }}</span>
      </router-link>
      <!-- walk around in the 3D room (free roam) -->
      <button v-if="mode === 'rom' && room.ready && route.name !== 'admin'" type="button" class="item roam" @click="room.roam = true; closeNav()">
        <Footprints :size="20" aria-hidden="true" />
        <span class="label">Gå rundt</span>
        <span class="tip">Gå rundt i rommet</span>
      </button>
    </nav>
    <!-- the hall is not a tab of the room – it is the way out of it, to look for another room: a door of its own -->
    <HallDoor v-if="!isPhone" />

    <span class="spacer" aria-hidden="true"></span>
    <!-- me / settings: my photo (logged in) or a cog – opens the menu with view, theme, language … -->
    <ViewSwitch v-if="!isPhone" />
    <SettingsMenu v-if="!isPhone" />
  </header>
  <teleport to="body">
    <div v-if="fly" ref="flyEl" class="fly" :style="{ top: `${fly.top}px`, left: `${fly.left}px` }" @mouseenter="keepFly" @mouseleave="closeFlySoon">
      <button v-for="(it, i) in fly.items" :key="it.id" class="fp glass" :style="{ '--i': i }" @click="pickFly(it)">
        <svg v-if="typeof it.icon === 'string'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="it.icon" /></svg>
        <component :is="it.icon" v-else-if="it.icon" :size="16" aria-hidden="true" />
        {{ it.label }}
      </button>
    </div>
  </teleport>
  <!-- phones: the whole menu sits behind the logo (tap it); the settings cog is in the other corner -->
  <div v-if="isPhone" class="mbar" aria-hidden="true"></div>
  <button v-if="isPhone" class="mlogo glass" :aria-expanded="navOpen" aria-label="Meny" @click="navOpen = !navOpen" @dblclick.prevent="toAdmin" @pointerdown="pressStart" @pointerup="pressEnd" @pointerleave="pressEnd"><X v-if="navOpen" :size="24" aria-hidden="true" /><Menu v-else :size="24" aria-hidden="true" /></button>
  <!-- phones: the way between the 3D room and the plain version sits flat in the bar, next to the menu -->
  <ViewSwitch v-if="isPhone" />
  <ProfileMenu v-if="isPhone" />
  <HallDoor v-if="isPhone" />
  <SettingsMenu v-if="isPhone" />
</template>

<style scoped>
.nav-wrap {
  position: fixed;
  top: 16px;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px;
  pointer-events: none;
  animation: navIn 0.9s var(--spring) backwards;
}
.nav-wrap > * { pointer-events: auto; }
@keyframes navIn { from { opacity: 0; transform: translateY(-30px) scale(0.9); } }

.brand {
  position: absolute;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 7px 16px;
  border-radius: 999px;
  color: var(--text);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
  transition: transform 0.4s var(--spring);
}
.brand:hover { transform: scale(1.04); }
.logo-full { height: 34px; }
.logo-mark { height: 30px; display: none; }

.nav {
  display: flex;
  padding: 6px;
  border-radius: 999px;
  gap: 2px;
}
.drop {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.55));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,1),
    inset 0 -1px 2px color-mix(in srgb, var(--accent) 15%, transparent),
    0 4px 14px color-mix(in srgb, var(--accent) 22%, transparent);
  opacity: 0;
  transition:
    transform 0.6s var(--spring),
    width 0.6s var(--spring),
    scale 0.3s var(--ease),
    opacity 0.3s;
}
:root[data-theme="dark"] .drop {
  background: linear-gradient(180deg, color-mix(in srgb, color-mix(in srgb, var(--accent) 80%, white) 28%, transparent), color-mix(in srgb, var(--accent) 14%, transparent));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 4px 18px color-mix(in srgb, var(--accent) 25%, transparent);
}
.drop.ready { opacity: 1; }
.drop.stretch { scale: 1.12 0.86; }

.item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  transition: color 0.3s;
}
.item:hover { color: var(--text); }
button.item { border: 0; background: transparent; font-family: inherit; cursor: pointer; }
.item.active { color: var(--accent); }
.item svg { transition: transform 0.5s var(--spring); }
.item:hover svg { transform: translateY(-1px) rotate(-6deg) scale(1.1); }
.item.active svg { transform: scale(1.08); }.install {
  text-decoration: none;
  position: fixed;
  height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #fff;
  font-weight: 600;
  font-size: 0.85rem;
  background: linear-gradient(135deg, var(--accent-2), var(--accent));
  box-shadow: 0 6px 18px var(--accent-glow);
  transition: transform 0.4s var(--spring);
  animation: navIn 0.6s var(--spring) both;
}
.install:hover { transform: translateY(-2px) scale(1.03); }
@media (max-width: 720px) { .install { display: none; } }.spin-enter-active, .spin-leave-active { transition: transform 0.4s var(--spring), opacity 0.2s; }
.spin-enter-from { transform: rotate(-90deg) scale(0.4); opacity: 0; }
.spin-leave-to { transform: rotate(90deg) scale(0.4); opacity: 0; }

.item .label, .tip, .spacer { display: none; }
@media (max-width: 720px) {
  .nav-wrap { top: auto; bottom: calc(14px + env(safe-area-inset-bottom)); }
  .brand { display: none; }
  /* phones: the bar spans the width and every icon gets an equal share, so none are cut off */
  .nav { padding: 5px; width: calc(100vw - 16px); max-width: 520px; }
  .drop { top: 5px; bottom: 5px; }
  .item { flex: 1 1 0; min-width: 0; justify-content: center; padding: 12px 0; }
}

@media (max-width: 720px) { .install { display: none; } }

/* Desktop: a slim rail down the left side – the full height of the screen is left for the room
   and the panels. Icons with small labels; on short screens only icons (the label shows on hover). */
@media (min-width: 721px) {
  .nav-wrap {
    top: 16px; bottom: 16px; left: 16px; right: auto;
    width: 76px;
    flex-direction: column; justify-content: flex-start; align-items: stretch;
    gap: 8px; padding: 0;
    animation-name: railIn;
  }
  @keyframes railIn { from { opacity: 0; transform: translateX(-30px) scale(0.94); } }
  /* the profile picture takes the logo's place at the top of the rail (the way to Admin is in its menu) */
  .brand { display: none; }
  .nav { flex-direction: column; padding: 6px; border-radius: 24px; gap: 2px; min-height: 0; overflow-y: auto; scrollbar-width: none; }
  .nav::-webkit-scrollbar { display: none; }
  .drop { top: 0; bottom: auto; border-radius: 17px; }
  .item { flex-direction: column; justify-content: center; gap: 3px; padding: 9px 0 7px; border-radius: 17px; }
  .item .label { display: block; font-size: 0.62rem; letter-spacing: 0.01em; line-height: 1; }
  .item:hover svg { transform: scale(1.12); }
  .spacer { display: block; flex: 1; }
  .install { display: none; }
  /* labels as tooltips when they're hidden */
  .tip {
    position: absolute; left: calc(100% + 14px); top: 50%;
    display: block; padding: 6px 10px; border-radius: 10px;
    background: var(--text); color: var(--bg); font-size: 0.78rem; font-weight: 600; white-space: nowrap;
    opacity: 0; transform: translate(-6px, -50%); pointer-events: none;
    transition: opacity 0.15s, transform 0.2s var(--ease);
  }
}
/* a bit lower screens: the labels stay, everything just sits a little tighter */
@media (min-width: 721px) and (max-height: 860px) {
  .nav-wrap { top: 10px; bottom: 10px; gap: 6px; }
  .item { padding: 7px 0 5px; }
}
/* only really low screens (under 700 px) lose the labels – they show on hover instead */
@media (min-width: 721px) and (max-height: 700px) {
  .item .label { display: none; }
  .item { padding: 11px 0; }
  .item:hover .tip { opacity: 1; transform: translate(0, -50%); }
  .nav { overflow: visible; }
}

/* phones: labels under the icons, so the tabs say what they are (the top bar of the plain version is in style.css) */
.mtop { display: none; }
/* phones: only icons (the top bar says where you are), a slim bar that slides away while you scroll down */
@media (max-width: 720px) {
  .nav-wrap { transition: transform 0.35s var(--ease, ease), opacity 0.25s; }
  .nav { padding: 4px; width: min(calc(100vw - 32px), 380px); }
  .drop { top: 4px; bottom: 4px; }
  .item { flex-direction: row; padding: 10px 0; }
  .item .label { display: none; }
}

/* phones: no bar at the bottom – the menu is behind the logo in the top-left corner and drops down when you tap it */
@media (max-width: 720px) {
  .nav-wrap { display: contents; animation: none; }
  .mlogo { position: fixed; top: calc(10px + env(safe-area-inset-top)); left: 12px; z-index: 42; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 0; border-radius: 14px; color: var(--text); cursor: pointer; transition: transform 0.3s var(--spring); }
  .mlogo:active { transform: scale(0.94); }
  /* one bar along the top: logo (menu) · the page's switch / title · settings */
  .mbar { position: fixed; z-index: 38; top: 0; left: 0; right: 0; height: calc(58px + env(safe-area-inset-top)); background: color-mix(in srgb, var(--bg) 74%, transparent); -webkit-backdrop-filter: blur(18px) saturate(150%); backdrop-filter: blur(18px) saturate(150%); border-bottom: 1px solid var(--glass-border); }
  html.classic .mbar { display: none; } /* the plain version has its own bar (.mtop) */
  .mlogo svg { height: 24px; width: 24px; }
  .nav { position: fixed; z-index: 41; top: calc(58px + env(safe-area-inset-top)); left: 12px; bottom: auto; right: auto; width: min(240px, 72vw); max-width: none; padding: 6px; flex-direction: column; border-radius: 20px; transform: translateY(-8px) scale(0.97); transform-origin: 0 0; opacity: 0; visibility: hidden; pointer-events: none; transition: transform 0.3s var(--spring), opacity 0.2s, visibility 0s 0.3s; }
  .nav.open { transform: none; opacity: 1; visibility: visible; pointer-events: auto; transition: transform 0.3s var(--spring), opacity 0.2s; }
  .drop { display: none; }
  .item { flex: none; flex-direction: row; justify-content: flex-start; gap: 12px; padding: 12px 14px; }
  .item .label { display: block; font-size: 0.95rem; }
  .item.active { background: var(--accent-soft); }
}
@media (min-width: 721px) { .mlogo { display: none; } }
</style>

<style>
/* the sub-tabs fan out of the main tab */
.fly { position: fixed; z-index: 44; transform: translateY(-50%); display: flex; gap: 8px; padding-left: 4px; }
.fly::before { content: ''; position: absolute; left: -14px; top: -14px; bottom: -14px; width: 18px; } /* (a bridge: the pointer can cross the gap from the tab) */
.fp { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 16px; border: 0; border-radius: 999px; color: var(--text); font: 700 0.88rem var(--font); white-space: nowrap; cursor: pointer; transform-origin: -30px 50%; animation: fpOut 0.55s var(--spring) both; animation-delay: calc(var(--i) * 70ms); transition: color 0.2s, scale 0.25s var(--spring); }
.fp:hover { color: var(--accent); scale: 1.06; }
.fp svg { color: var(--accent); }
@keyframes fpOut { from { opacity: 0; transform: translateX(-46px) scale(0.35) rotate(-14deg); } 60% { opacity: 1; } }
html.flying [aria-label="Underfaner"], html.flying .msw .cam { opacity: 0; animation: none; }
@media (prefers-reduced-motion: reduce) { .fp { animation: none; } }
</style>

<style>
/* phones: the 2D / 3D button sits flat in the bar, next to the menu */
@media (max-width: 720px) {
  html body .vs.vs { position: fixed; top: calc(10px + env(safe-area-inset-top)); left: 58px; z-index: 42; flex-direction: row; gap: 4px; height: 42px; width: auto; min-width: 42px; padding: 0 10px; border-radius: 0; background: transparent; box-shadow: none; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; touch-action: manipulation; }
  html body .vs.vs::before, html body .vs.vs::after { display: none; }
  html body .vs.vs b { font-size: 0.8rem; }
  html body .vs.vs:active { color: var(--accent); }
}
/* phones: logo and cog sit flat in the bar (no pills of their own) */
@media (max-width: 720px) {
  html body .mlogo.mlogo, html body .sm.sm { background: transparent; box-shadow: none; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
  html body .mlogo.mlogo::before, html body .mlogo.mlogo::after, html body .sm.sm::before, html body .sm.sm::after { display: none; }
}
/* the settings button (SettingsMenu): the last thing in the rail; on phones in the top-right corner */
@media (min-width: 721px) { .nav-wrap .sm { align-self: center; flex: none; width: 50px; height: 50px; } .nav-wrap .vs { margin-bottom: -2px; } .nav-wrap .sm.profile { width: 58px; height: 58px; } }
@media (min-width: 721px) and (max-height: 860px) { .nav-wrap .sm { width: 44px; height: 44px; } .nav-wrap .sm.profile { width: 50px; height: 50px; } }
@media (max-width: 720px) {
  html body .sm.sm { position: fixed; top: calc(12px + env(safe-area-inset-top)); right: 12px; width: 42px; height: 42px; z-index: 41; }
  html.classic body .sm.sm { box-shadow: none; }
}
/* phones: the menu slides away while scrolling down (class set in the script) */
@media (max-width: 720px) {
  html.nav-hidden .nav-wrap { transform: translateY(calc(100% + 28px)); opacity: 0; pointer-events: none; }
}
</style>
