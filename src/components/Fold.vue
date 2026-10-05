<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

// A section that can be folded away – used on phones, where the overview would otherwise be a very long scroll. Where there
// is room (`fold` false) it renders just its content, so the PC looks like before.
defineProps({ title: { type: String, required: true }, hint: { type: String, default: '' }, fold: { type: Boolean, default: true } })
</script>

<template>
  <details v-if="fold" class="fold">
    <summary><span>{{ title }}</span><small v-if="hint">{{ hint }}</small><ChevronDown class="chev" :size="18" aria-hidden="true" /></summary>
    <div class="inner"><slot /></div>
  </details>
  <slot v-else />
</template>

<style scoped>
.fold { border-radius: 16px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
.fold summary { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 14px; cursor: pointer; list-style: none; font-weight: 700; font-size: 0.92rem; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.fold summary::-webkit-details-marker { display: none; }
.fold summary small { margin-left: auto; color: var(--text-3); font-weight: 600; font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.fold summary .chev { flex: none; margin-left: auto; color: var(--text-3); transition: transform 0.25s var(--spring); }
.fold summary small + .chev { margin-left: 0; }
.fold[open] summary .chev { transform: rotate(180deg); }
.inner { padding: 0 8px 12px; min-width: 0; }
.inner > :deep(*) { box-shadow: none; }
</style>
