<script setup lang="ts">
import { tx } from '../composables/useTexts'
import JapanContent from '../components/JapanContent.vue'
</script>

<template>
  <div class="cpage japan">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('japan.eyebrow') }}</div>
      <h1>{{ tx('japan.title') }}</h1>
      <p>Det jeg lærer på jpdb.</p>
    </header>
    <div class="glass card jp-card"><JapanContent /></div>
  </div>
</template>

<style scoped>
.japan { width: min(1240px, 100%); }
.jp-card { container-type: inline-size; }
</style>
