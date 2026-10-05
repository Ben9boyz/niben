<script setup lang="ts" generic="T extends string | number">
import { computed, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

// The site's one tab switch: a glass pill with a marker that slides to the chosen tab.
// items: [{ id, label, icon? (SVG path or a component), to? (route → a link), count? }]
// Used for the sub-tabs, Album / Spillelister, and the tabs inside the Japanese corner.
const props = withDefaults(defineProps<{
  items: { id: T; label: string; icon?: string | Component; to?: RouteLocationRaw; count?: number | string }[]
  modelValue?: T | null
  floating?: boolean // over the 3D room, top-left
  small?: boolean
  stretch?: boolean // fill the width (inside a card)
  label?: string
}>(), { modelValue: null, label: 'Faner' })
const emit = defineEmits<{ 'update:modelValue': [id: T] }>()
const index = computed(() => Math.max(0, props.items.findIndex((x) => x.id === props.modelValue)))
</script>

<template>
  <nav class="seg glass" :class="{ floating, small, stretch }" role="tablist" :aria-label="label" :style="{ '--n': items.length }">
    <span class="mark" :style="{ transform: `translateX(${index * 100}%)` }"></span>
    <component
      :is="it.to ? 'router-link' : 'button'"
      v-for="it in items"
      :key="it.id"
      :to="it.to"
      :type="it.to ? undefined : 'button'"
      role="tab"
      :aria-selected="it.id === modelValue"
      :class="{ on: it.id === modelValue }"
      @click="!it.to && emit('update:modelValue', it.id)"
    >
      <svg v-if="typeof it.icon === 'string'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="it.icon" /></svg>
      <component :is="it.icon" v-else-if="it.icon" :size="16" aria-hidden="true" />
      <span class="lbl">{{ it.label }}</span>
      <small v-if="it.count">{{ it.count }}</small>
    </component>
  </nav>
</template>

<style scoped>
.seg { position: relative; display: grid; grid-template-columns: repeat(var(--n), 1fr); width: max-content; max-width: calc(100vw - 32px); padding: 5px; border-radius: 999px; pointer-events: auto; }
.seg.stretch { width: 100%; max-width: none; }
.seg.floating { position: fixed; top: 20px; left: calc(var(--rail) + 16px); z-index: 35; animation: drop 0.6s var(--spring) both; }
@media (max-width: 720px) { .seg.floating { top: calc(10px + env(safe-area-inset-top)); left: 62px; max-width: calc(100vw - 62px - 112px); } .seg.floating small { display: none; } .seg.floating > a, .seg.floating > button { padding: 9px 12px; } }
@keyframes drop { from { opacity: 0; transform: translateY(-14px) scale(0.95); } }
.mark { position: absolute; top: 5px; bottom: 5px; left: 5px; width: calc((100% - 10px) / var(--n)); border-radius: 999px; background: var(--glass-strong); box-shadow: inset 0 1px 0 var(--glass-hi), 0 4px 12px rgba(43, 140, 255, 0.18); transition: transform 0.5s var(--spring); }
.seg > a, .seg > button { position: relative; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 18px; border: 0; background: none; color: var(--text-2); font: 600 0.9rem var(--font); white-space: nowrap; text-decoration: none; cursor: pointer; transition: color 0.3s; }
.seg > a:hover, .seg > button:hover { color: var(--text); }
.seg > .on { color: var(--accent); }
.seg small { opacity: 0.55; font-weight: 600; }
.seg.small > a, .seg.small > button { padding: 7px 10px; font-size: 0.82rem; gap: 6px; }
@media (max-width: 720px) {
  .seg.floating { top: 70px; left: 50%; translate: -50% 0; }
  .seg > a, .seg > button { padding: 8px 12px; font-size: 0.82rem; gap: 5px; }
}
@media (max-width: 480px) {
  .seg.small > a, .seg.small > button { flex-direction: column; gap: 2px; font-size: 0.72rem; padding: 6px 2px; }
}
</style>
