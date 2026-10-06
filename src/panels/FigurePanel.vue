<script setup lang="ts">
import { tx } from '@/composables/site/useTexts'
import FigureContent from '@/components/figures/FigureContent.vue'
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('figures.eyebrow') }}</div>
      <h2>{{ tx('figures.title') }}</h2>
      <p>{{ tx('figures.hint') }}</p>
    </header>
    <div class="panel-body"><FigureContent /></div>
  </section>
</template>
