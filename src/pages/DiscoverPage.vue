<script setup>
import { tx } from '../composables/useTexts'
import DiscoverContent from '../components/DiscoverContent.vue'
</script>

<template>
  <div class="cpage discover">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('discover.eyebrow') }}</div>
      <h1>{{ tx('discover.title') }}</h1>
    </header>
    <div class="glass card"><DiscoverContent /></div>
  </div>
</template>

<style scoped>
.discover { width: min(1100px, 100%); }
</style>
