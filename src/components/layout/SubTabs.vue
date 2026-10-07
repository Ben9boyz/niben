<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { groupOf, tabLabel, tabTarget, routeKey, tabIcon } from '@/lib/nav'
import SegSwitch from '@/components/ui/SegSwitch.vue'

// The sub-tabs of the current group (Lære: Japansk / Gitar-øving …) – the same switch as Album / Spillelister.
// `floating` = over the 3D room, top-left; otherwise at the top of the page.
defineProps<{ floating?: boolean }>()
const route = useRoute()
const items = computed(() => {
  const g = groupOf(routeKey(route))
  return g && g.routes.length > 1 ? g.routes.map((r) => ({ id: r, label: tabLabel(r), icon: tabIcon(r), to: tabTarget(r) })) : null
})
</script>

<template>
  <SegSwitch v-if="items" :items="items" :model-value="routeKey(route)" :small="items.length > 3" :floating="floating" label="Underfaner" />
</template>
