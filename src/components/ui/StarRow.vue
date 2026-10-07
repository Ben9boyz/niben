<script setup lang="ts">
import { Star } from 'lucide-vue-next'
// A rating as five stars from the icon set (filled up to `value`).
withDefaults(defineProps<{ value: number; size?: number }>(), { size: 14 })
</script>

<template>
  <span class="sr" :aria-label="`${Math.round(value)} av 5`"><Star v-for="n in 5" :key="n" :size="size" :class="{ on: n <= Math.round(value) }" aria-hidden="true" /></span>
</template>

<style scoped>
.sr { display: inline-flex; gap: 1px; color: #f5a524; vertical-align: -2px; }
.sr svg { fill: none; opacity: 0.45; } .sr svg.on { fill: currentColor; opacity: 1; }
</style>
