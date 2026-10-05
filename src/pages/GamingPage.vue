<script setup>
import { tx } from '../composables/useTexts'
import GamingContent from '../components/GamingContent.vue'
</script>

<template>
  <div class="cpage gaming">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('gaming.eyebrow') }}</div>
      <h1>{{ tx('gaming.title') }}</h1>
      <p>Hva jeg spiller på Steam.</p>
    </header>
    <div class="glass card"><GamingContent /></div>
  </div>
</template>

<style scoped>
.gaming { width: min(1240px, 100%); }
</style>
