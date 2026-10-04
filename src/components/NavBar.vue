<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
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

const links = [
  { to: '/', name: 'hjem', label: 'Hjem', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/gitar', name: 'gitar', label: 'Gitar', icon: 'M19.6 2.6l1.8 1.8-2.1 2.1.6.6-1.4 1.4-.6-.6-3.3 3.3a4 4 0 0 1-1 5.2 4.6 4.6 0 0 1-3 4.4 5 5 0 0 1-6.5-6.5 4.6 4.6 0 0 1 4.4-3 4 4 0 0 1 5.2-1l3.3-3.3-.6-.6 1.4-1.4.6.6zM8.5 13a2 2 0 1 0 2.5 2.5' },
  { to: '/lytte', name: 'lytte', label: 'Musikk', icon: 'M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { to: '/ovelse', name: 'ovelse', label: 'Øving', icon: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-12v4l2.5 2.5M10 2h4M12 2v3' },
  { to: '/boker', name: 'boker', label: 'Bøker', icon: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13z' },
  { to: '/reiser', name: 'reiser', label: 'Reiser', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3.5 9h17M3.5 15h17' },
  { to: '/kode', name: 'kode', label: 'Kode', icon: 'M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16' },
  { to: '/japansk', name: 'japansk', label: 'Japansk', icon: 'M3 5.5c3.5 1.2 14.5 1.2 18 0M5 9.5h14M7.5 6.5V21M16.5 6.5V21M12 6.8v2.7' },
  { to: '/om', name: 'om', label: 'Om meg', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' },
]

const track = ref(null)
const itemEls = ref([])
const drop = ref({ x: 0, w: 0, ready: false })
const stretching = ref(false)
const scrolled = ref(false)

function place() {
  const idx = links.findIndex((l) => l.name === route.name)
  const el = itemEls.value[idx]
  if (!el || !track.value) return
  const prev = drop.value.x
  drop.value = { x: el.offsetLeft, w: el.offsetWidth, ready: true }
  if (prev !== drop.value.x) {
    stretching.value = true
    setTimeout(() => (stretching.value = false), 260)
  }
}

watch(() => route.name, () => nextTick(place))
function onScroll() { scrolled.value = window.scrollY > 12 }
onMounted(() => {
  nextTick(place)
  document.fonts?.ready.then(place)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', onScroll, { passive: true })
  checkLogin()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
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
        :style="{ transform: `translateX(${drop.x}px)`, width: `${drop.w}px` }"
      ></span>
      <router-link
        v-for="(l, i) in links"
        :key="l.name"
        :to="l.to"
        class="item"
        :class="{ active: route.name === l.name }"
        :ref="(el) => (itemEls[i] = el?.$el ?? el)"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="l.icon" /></svg>
        <span class="label">{{ l.label }}</span>
      </router-link>
    </nav>

    <router-link to="/admin" class="admin-chip glass" :class="{ on: admin.loggedIn }" :title="admin.loggedIn ? 'Admin (innlogget)' : 'Admin'" aria-label="Admin">
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
@media (max-width: 1280px) { .install span { display: none; } .install { padding: 0 14px; } }
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
@media (max-width: 1080px) { .admin-chip { left: 72px; } }
@media (max-width: 720px) { .admin-chip { position: fixed; top: 18px; left: 14px; } }
.spin-enter-active, .spin-leave-active { transition: transform 0.4s var(--spring), opacity 0.2s; }
.spin-enter-from { transform: rotate(-90deg) scale(0.4); opacity: 0; }
.spin-leave-to { transform: rotate(90deg) scale(0.4); opacity: 0; }

@media (max-width: 1180px) {
  .mode span { display: none; }
  .mode { padding: 0 15px; right: 82px; }
}
@media (max-width: 1080px) {
  .logo-full { display: none; }
  .logo-mark { display: block; }
  .brand { padding: 7px 10px; }
}
@media (max-width: 1120px) {
  .item .label { display: none; }
  .item { padding: 10px 14px; }
}
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

/* Desktop: everything in one row at the top-left, so the right side is free for the panel */
@media (min-width: 721px) {
  .nav-wrap { justify-content: flex-start; padding: 0 20px; }
  .brand, .admin-chip, .mode, .theme { position: relative; left: auto; right: auto; top: auto; flex: none; }
  .admin-chip { order: 1; }
  .brand { order: 0; }
  .nav { order: 2; }
  .mode { order: 3; }
  .theme { order: 4; }
  .install { order: 5; position: relative; }
  .mode span { display: none; }
  .mode { padding: 0 15px; }
  .item { padding: 10px 12px; }
}
</style>
