<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { groupOf, TAB_LABELS, ROUTE_ICONS } from '../lib/nav'
import SegSwitch from '@/components/ui/SegSwitch.vue'

// The sub-tabs of the current group (Lære: Japansk / Gitar-øving …) – the same switch as Album / Spillelister.
// `floating` = over the 3D room, top-left; otherwise at the top of the page.
defineProps<{ floating?: boolean }>()
const route = useRoute()
const items = computed(() => {
  const g = groupOf(route.name)
  return g && g.routes.length > 1 ? g.routes.map((r) => ({ id: r, label: TAB_LABELS[r] ?? r, icon: ROUTE_ICONS[r], to: { name: r } })) : null
})
</script>

<template>
  <SegSwitch v-if="items" :items="items" :model-value="String(route.name)" :floating="floating" label="Underfaner" />
</template>
