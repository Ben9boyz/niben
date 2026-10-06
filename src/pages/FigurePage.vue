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
    <div class="glass card"><FigureContent /></div>
  </div>
</template>

<style scoped>
.figpage { width: min(680px, 100%); }
.card { padding: 18px; border-radius: 22px; }
</style>
