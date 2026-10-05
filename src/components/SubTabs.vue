<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { groupOf, TAB_LABELS } from '../lib/nav'

// The sub-tabs of the current group (Lære: Japansk / Gitar-øving …), drawn exactly like the music
// corner's Album / Spillelister switch: a glass pill with a sliding marker. `floating` = over the 3D
// room, top-left in the same spot as the music switch; otherwise it sits at the top of the page.
defineProps({ floating: Boolean })
const route = useRoute()
const tabs = computed(() => {
  const g = groupOf(route.name)
  return g && g.routes.length > 1 ? g.routes : null
})
const index = computed(() => Math.max(0, tabs.value?.indexOf(route.name) ?? 0))

const ICONS = {
  japansk: 'M3 5.5c3.5 1.2 14.5 1.2 18 0M5 9.5h14M7.5 6.5V21M16.5 6.5V21M12 6.8v2.7',
  ovelse: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-12v4l2.5 2.5M10 2h4M12 2v3',
  gitar: 'M19.6 2.6l1.8 1.8-2.1 2.1.6.6-1.4 1.4-.6-.6-3.3 3.3a4 4 0 0 1-1 5.2 4.6 4.6 0 0 1-3 4.4 5 5 0 0 1-6.5-6.5 4.6 4.6 0 0 1 4.4-3 4 4 0 0 1 5.2-1l3.3-3.3-.6-.6 1.4-1.4.6.6zM8.5 13a2 2 0 1 0 2.5 2.5',
  kode: 'M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16',
  reiser: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3.5 9h17M3.5 15h17',
  boker: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13z',
  gaming: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.9 7.2A3 3 0 0 0 4.8 19a3 3 0 0 0 2.6-1.5L8 16h8l.6 1.5a3 3 0 0 0 2.6 1.5 3 3 0 0 0 3-3.2l-.9-7.2a4 4 0 0 0-4-3.6z',
}
</script>

<template>
  <nav v-if="tabs" class="switch glass" :class="{ floating }" role="tablist" aria-label="Underfaner" :style="{ '--n': tabs.length }">
    <span class="pill" :style="{ transform: `translateX(${index * 100}%)` }"></span>
    <router-link v-for="r in tabs" :key="r" :to="{ name: r }" role="tab" :aria-selected="route.name === r" :class="{ on: route.name === r }">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="ICONS[r]" /></svg>
      {{ TAB_LABELS[r] }}
    </router-link>
  </nav>
</template>

<style scoped>
/* same look as MusicSwitch.vue */
.switch {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 5px;
  border-radius: 999px;
  pointer-events: auto;
  animation: drop 0.6s var(--spring) both;
}
.switch.floating { position: fixed; top: 20px; left: calc(var(--rail) + 16px); z-index: 35; }
@keyframes drop { from { opacity: 0; transform: translateY(-14px) scale(0.95); } }
.pill {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc((100% - 10px) / var(--n));
  border-radius: 999px;
  background: var(--glass-strong);
  box-shadow: inset 0 1px 0 var(--glass-hi), 0 4px 12px rgba(43, 140, 255, 0.18);
  transition: transform 0.5s var(--spring);
}
a {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 18px;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  text-decoration: none;
  transition: color 0.3s;
}
a:hover { color: var(--text); }
a.on { color: var(--accent); }
@media (max-width: 720px) {
  .switch.floating { top: 70px; left: 50%; translate: -50% 0; }
  a { padding: 8px 12px; font-size: 0.82rem; gap: 5px; }
}
</style>
