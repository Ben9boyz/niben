<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { GROUPS, groupOf, groupTarget } from '../lib/nav'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'
import { mode, toggleMode } from '../composables/useMode'
import { admin, checkLogin } from '../composables/useAdmin'
import { pwa, install, desktopApp } from '../composables/usePwa'
import BrandLogo from './BrandLogo.vue'

const route = useRoute()
const router = useRouter()

// Hidden way into the admin page: double-click (or long-press) the logo
let pressTimer = 0
function toAdmin() { router.push('/admin') }
function pressStart(e) {
  if (e.pointerType !== 'touch') return
  pressTimer = setTimeout(toAdmin, 600)
}
function pressEnd() { clearTimeout(pressTimer) }
const { theme, toggle } = useTheme()

// the menu shows the main tabs; the sub-tabs are pills inside the page (SubTabs). A tab opens the
// sub-tab you were last on.
const links = computed(() => GROUPS.map((g) => ({ name: g.id, label: g.label, icon: g.icon, to: groupTarget(g) })))
const activeGroup = computed(() => groupOf(route.name)?.id)
// phones (plain version): a top bar with the page's name – the group (its sub-tabs sit just below)
const barTitle = computed(() => (route.name === 'hjem' ? '' : route.name === 'admin' ? 'Admin' : groupOf(route.name)?.label || route.meta?.title || ''))

const track = ref(null)
const itemEls = ref([])
const drop = ref({ x: 0, y: 0, w: 0, h: 0, ready: false })
const rail = window.matchMedia('(min-width: 721px)')
const stretching = ref(false)
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
watch(() => route.fullPath, () => setHidden(false))
const phone = window.matchMedia('(max-width: 720px)')
let lastY = 0
function setHidden(v) { document.documentElement.classList.toggle('nav-hidden', v) }
function onScroll() {
  const y = window.scrollY
  scrolled.value = y > 12
  if (!phone.matches) return setHidden(false)
  // down = out of the way (the page is what you're reading); up, or back at the top = back
  if (y > lastY + 10 && y > 90) setHidden(true)
  else if (y < lastY - 6 || y < 40) setHidden(false)
  lastY = y
}
onMounted(() => {
  nextTick(place)
  document.fonts?.ready.then(place)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', onScroll, { passive: true })
  checkLogin()
})
onBeforeUnmount(() => {
  setHidden(false)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <!-- phones, plain version: the bar behind the page name and the buttons on the right -->
  <div class="mtop" :class="{ scrolled }" aria-hidden="true">
    <router-link to="/" class="mtop-brand" tabindex="-1" @dblclick.prevent="toAdmin" @pointerdown="pressStart" @pointerup="pressEnd" @pointerleave="pressEnd"><BrandLogo :mark="!!barTitle" /></router-link>
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

    <nav class="nav glass" ref="track">
      <span
        class="drop"
        :class="{ ready: drop.ready, stretch: stretching }"
        :style="{ transform: `translate(${drop.x}px, ${drop.y}px)`, width: `${drop.w}px`, height: drop.h ? `${drop.h}px` : null }"
      ></span>
      <router-link
        v-for="(l, i) in links"
        :key="l.name"
        :to="l.to"
        class="item"
        :class="{ active: activeGroup === l.name }"
        :ref="(el) => (itemEls[i] = el?.$el ?? el)"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="l.icon" /></svg>
        <span class="label">{{ l.label }}</span>
        <span class="tip">{{ l.label }}</span>
      </router-link>
    </nav>

    <span class="spacer" aria-hidden="true"></span>
    <!-- the music player on its own (same as the "niben musikk" app) – small, at the bottom of the rail -->
    <a href="#/musicplayer" class="player-link" title="Åpne musikkspilleren" aria-label="Åpne musikkspilleren">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3zM3 16a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H3z" /></svg>
    </a>
    <!-- only when logged in; the way in is a double-click (or long-press) on the logo -->
    <router-link v-if="admin.loggedIn" to="/admin" class="admin-chip glass on" title="Admin (innlogget)" aria-label="Admin">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    </router-link>

    <a v-if="desktopApp" class="install glass" :href="desktopApp.url" download :title="`Last ned niben-appen for ${desktopApp.os} – alltid oppdatert, med tyngre grafikk`">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" /></svg>
      <span>Last ned app</span>
    </a>
    <button v-else-if="pwa.canInstall && !pwa.installed" class="install glass" @click="install" title="Installer niben som app">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" /></svg>
      <span>Installer app</span>
    </button>

    <button class="mode glass" @click="toggleMode" :title="mode === 'rom' ? 'Bytt til enkel versjon' : 'Bytt til 3D-rommet'">
      <svg v-if="mode === 'rom'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z" /><path d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5" /></svg>
      <span>{{ mode === 'rom' ? 'Enkel' : '3D-rom' }}</span>
    </button>

    <button class="theme glass" @click="toggle" :aria-label="theme === 'dark' ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'">
      <transition name="spin" mode="out-in">
        <svg v-if="theme === 'dark'" key="sun" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        <svg v-else key="moon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
      </transition>
    </button>
  </header>
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
    inset 0 -1px 2px rgba(43,140,255,.15),
    0 4px 14px rgba(43,140,255,.22);
  opacity: 0;
  transition:
    transform 0.6s var(--spring),
    width 0.6s var(--spring),
    scale 0.3s var(--ease),
    opacity 0.3s;
}
:root[data-theme="dark"] .drop {
  background: linear-gradient(180deg, rgba(120,190,255,.28), rgba(92,182,255,.14));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 4px 18px rgba(92,182,255,.25);
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
.item.active { color: var(--accent); }
.item svg { transition: transform 0.5s var(--spring); }
.item:hover svg { transform: translateY(-1px) rotate(-6deg) scale(1.1); }
.item.active svg { transform: scale(1.08); }

.theme {
  position: absolute;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--text-2);
  transition: transform 0.5s var(--spring), color 0.3s;
}
.theme:hover { transform: rotate(20deg) scale(1.08); color: var(--accent); }
.mode {
  position: absolute;
  right: 82px;
  height: 48px;
  padding: 0 16px;
  border-radius: 999px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.88rem;
  transition: transform 0.45s var(--spring), color 0.3s;
}
.mode:hover { transform: scale(1.05); color: var(--accent); }
.install {
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
@media (max-width: 720px) { .install { display: none; } }
.admin-chip {
  position: absolute;
  left: 140px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-3);
  opacity: 0.45;
  transition: transform 0.4s var(--spring), opacity 0.3s, color 0.3s;
}
.admin-chip:hover { transform: scale(1.08); opacity: 1; color: var(--accent); }
.admin-chip.on { opacity: 1; color: var(--accent); }
.spin-enter-active, .spin-leave-active { transition: transform 0.4s var(--spring), opacity 0.2s; }
.spin-enter-from { transform: rotate(-90deg) scale(0.4); opacity: 0; }
.spin-leave-to { transform: rotate(90deg) scale(0.4); opacity: 0; }

.item .label, .tip, .spacer { display: none; }
@media (max-width: 720px) {
  .nav-wrap { top: auto; bottom: calc(14px + env(safe-area-inset-bottom)); }
  .brand { display: none; }
  .theme {
    position: fixed;
    top: 14px;
    right: 14px;
    bottom: auto;
  }
  .mode {
    position: fixed;
    top: 14px;
    right: 72px;
    bottom: auto;
  }
  /* phones: the bar spans the width and every icon gets an equal share, so none are cut off */
  .nav { padding: 5px; width: calc(100vw - 16px); max-width: 520px; }
  .drop { top: 5px; bottom: 5px; }
  .item { flex: 1 1 0; min-width: 0; justify-content: center; padding: 12px 0; }
}

/* phones: the admin chip (only shown when logged in) sits top-left */
@media (max-width: 720px) {
  .admin-chip { position: fixed; top: 18px; left: 14px; }
  .install { display: none; }
}

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
  .brand { position: relative; left: auto; justify-content: center; height: 58px; padding: 0; border-radius: 22px; flex: none; }
  .brand:hover { transform: scale(1.05) rotate(-3deg); }
  .logo-full { display: none; }
  .logo-mark { display: block; height: 32px; }
  .nav { flex-direction: column; padding: 6px; border-radius: 24px; gap: 2px; min-height: 0; overflow-y: auto; scrollbar-width: none; }
  .nav::-webkit-scrollbar { display: none; }
  .drop { top: 0; bottom: auto; border-radius: 17px; }
  .item { flex-direction: column; justify-content: center; gap: 3px; padding: 9px 0 7px; border-radius: 17px; }
  .item .label { display: block; font-size: 0.62rem; letter-spacing: 0.01em; line-height: 1; }
  .item:hover svg { transform: scale(1.12); }
  .spacer { display: block; flex: 1; }
  .admin-chip, .mode, .theme, .install {
    position: relative; left: auto; right: auto; top: auto;
    align-self: center; flex: none;
    width: 50px; height: 50px; padding: 0; border-radius: 17px;
    justify-content: center; display: grid; place-items: center;
    animation: none;
  }
  .admin-chip { opacity: 1; }
  .mode span, .install span { display: none; }
  .install:hover { transform: scale(1.06); }
  .theme:hover { transform: rotate(20deg) scale(1.06); }
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
  .brand { height: 50px; }
  .item { padding: 7px 0 5px; }
  .admin-chip, .mode, .theme, .install { width: 44px; height: 44px; }
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
.player-link { display: none; }
@media (min-width: 721px) {
  .player-link { display: grid; place-items: center; align-self: center; width: 40px; height: 40px; border-radius: 14px; color: var(--text-3); opacity: 0.6; transition: opacity 0.2s, color 0.2s, background 0.2s; }
  .player-link:hover { opacity: 1; color: var(--accent); background: var(--accent-soft); }
}
/* phones: only icons (the top bar says where you are), a slim bar that slides away while you scroll down */
@media (max-width: 720px) {
  .nav-wrap { transition: transform 0.35s var(--ease, ease), opacity 0.25s; }
  .nav { padding: 4px; width: min(calc(100vw - 32px), 380px); }
  .drop { top: 4px; bottom: 4px; }
  .item { flex-direction: row; padding: 10px 0; }
  .item .label { display: none; }
}
</style>

<style>
/* phones: the menu slides away while scrolling down (class set in the script) */
@media (max-width: 720px) {
  html.nav-hidden .nav-wrap { transform: translateY(calc(100% + 28px)); opacity: 0; pointer-events: none; }
}
</style>
