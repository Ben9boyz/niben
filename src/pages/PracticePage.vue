<script setup lang="ts">
import { tx } from '../composables/useTexts'
import PracticePanel from '../panels/PracticePanel.vue'
</script>

<template>
  <div class="cpage narrow">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('practice.eyebrow') }}</div>
      <h1>{{ tx('practice.title') }}</h1>
      <p>Timer, akkorder, stemmeapparat og metronom – alt du trenger for å øve.</p>
    </header>
    <PracticePanel />
  </div>
</template>

<style scoped>
.narrow { width: min(600px, 100%); }
</style>
