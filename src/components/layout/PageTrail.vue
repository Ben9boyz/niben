<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { groupOf, groupTarget, routeKey, tabLabel } from '@/lib/nav'
import { rooms } from '@/composables/room/useRooms'
import { useData } from '@/composables/site/useData'

// The path at the top of every page (plain version): which room you are in → the menu tab → the page.
// The same line on every page, so you always know where you stand and can step back up. Not on the front page.
const route = useRoute()
const data = useData()
const room = computed(() => rooms.current || data.profile.username || '')
const steps = computed(() => {
  if (route.name === 'hjem') return null
  if (route.name === 'admin') return [{ label: 'Admin', to: null }]
  const key = routeKey(route)
  const g = groupOf(key)
  const page = tabLabel(key) || String(route.meta?.title ?? '')
  const out: { label: string; to: ReturnType<typeof groupTarget> | null }[] = []
  if (g && g.label !== page) out.push({ label: g.label, to: g.routes.length > 1 ? groupTarget(g) : null })
  out.push({ label: page, to: null })
  return out
})
</script>

<template>
  <nav v-if="steps" class="trail" aria-label="Du er her">
    <router-link to="/" class="here"><span class="dot" aria-hidden="true"></span>{{ room ? `Rommet til ${room}` : 'Rommet' }}</router-link>
    <template v-for="(s, i) in steps" :key="i">
      <span class="sep" aria-hidden="true">/</span>
      <router-link v-if="s.to" :to="s.to">{{ s.label }}</router-link>
      <b v-else aria-current="page">{{ s.label }}</b>
    </template>
  </nav>
</template>

<style scoped>
.trail { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: min(var(--page-max, 1360px), 100%); margin: 0 auto; padding: 28px 32px 0; font-size: 0.86rem; font-weight: 600; color: var(--text-2); }
.trail a { color: var(--text-2); text-decoration: none; border-radius: 6px; }
.trail a:hover { color: var(--accent-ink); }
.trail b { color: var(--text); font-weight: 700; }
.here { display: inline-flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.sep { opacity: 0.45; }
/* phones: the top bar already names the page */
@media (max-width: 720px) { .trail { display: none; } }
</style>
