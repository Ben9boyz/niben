<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { groupOf, TAB_LABELS, ROUTE_ICONS } from '../lib/nav'
import SegSwitch from './SegSwitch.vue'

// The sub-tabs of the current group (Lære: Japansk / Gitar-øving …) – the same switch as Album / Spillelister.
// `floating` = over the 3D room, top-left; otherwise at the top of the page.
defineProps({ floating: Boolean })
const route = useRoute()
const items = computed(() => {
  if (route.name === 'lytte') return null // the library has its own switches (Album / Spillelister / Alt); Oppdag is reached from there
  const g = groupOf(route.name)
  return g && g.routes.length > 1 ? g.routes.map((r) => ({ id: r, label: TAB_LABELS[r], icon: ROUTE_ICONS[r], to: { name: r } })) : null
})
</script>

<template>
  <SegSwitch v-if="items" :items="items" :model-value="route.name" :floating="floating" label="Underfaner" />
</template>
