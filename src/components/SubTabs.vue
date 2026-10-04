<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { groupOf, TAB_LABELS } from '../lib/nav'

// The pills for the sub-tabs of the current group (Lære: Japansk / Gitar-øving …). Nothing for single-page groups.
const route = useRoute()
const tabs = computed(() => {
  const g = groupOf(route.name)
  return g && g.routes.length > 1 ? g.routes : null
})
</script>

<template>
  <nav v-if="tabs" class="subtabs glass" role="tablist" aria-label="Underfaner">
    <router-link v-for="r in tabs" :key="r" :to="{ name: r }" role="tab" :aria-selected="route.name === r" :class="{ on: route.name === r }">{{ TAB_LABELS[r] }}</router-link>
  </nav>
</template>

<style scoped>
.subtabs { display: flex; gap: 2px; padding: 4px; border-radius: 999px; width: max-content; max-width: 100%; overflow-x: auto; scrollbar-width: none; pointer-events: auto; }
.subtabs::-webkit-scrollbar { display: none; }
.subtabs a { padding: 7px 16px; border-radius: 999px; color: var(--text-2); font: 600 0.88rem var(--font); white-space: nowrap; transition: background 0.2s, color 0.2s; }
.subtabs a:hover { color: var(--text); }
.subtabs a.on { background: var(--accent); color: #fff; box-shadow: 0 4px 14px var(--accent-glow); }
</style>
