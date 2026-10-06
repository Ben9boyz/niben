<script setup lang="ts">
import { tx } from '@/composables/site/useTexts'
import YearContent from '@/components/content/YearContent.vue'
</script>

<template>
  <div class="cpage yearpage">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('year.eyebrow') }}</div>
      <h1>{{ tx('year.title') }}</h1>
      <p>Musikk, bøker, reiser, spill og japansk – samlet, og klart til å deles.</p>
    </header>
    <YearContent />
  </div>
</template>

<style scoped>
.yearpage { width: min(1000px, 100%); }
</style>
