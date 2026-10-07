<script setup lang="ts">
import { tx } from '@/composables/site/useTexts'
import FigureContent from '@/components/figures/FigureContent.vue'
</script>

<template>
  <div class="cpage figpage">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('figures.eyebrow') }}</div>
      <h1>{{ tx('figures.title') }}</h1>
    </header>
    <div class="glass card figs"><FigureContent /><div class="ledge" aria-hidden="true"></div></div>
  </div>
</template>

<style scoped>
.ledge { height: 16px; margin-top: 14px; border-radius: 6px; background: radial-gradient(140% 40% at 50% 0%, rgba(255, 255, 255, 0.55), transparent 70%), linear-gradient(90deg, #e7d5b9, #f1e3cc 45%, #e7d5b9); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 14px -6px rgba(90, 70, 40, 0.35); }
:root[data-theme="dark"] .ledge { background: linear-gradient(90deg, #3b2c1e, #4a3726 45%, #3b2c1e); }
.figpage { width: min(1100px, 100%); }
.card { padding: 18px; border-radius: 22px; }
</style>
