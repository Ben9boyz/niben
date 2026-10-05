<script setup>
import { tx } from '../composables/useTexts'
import GamingContent from '../components/GamingContent.vue'
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('gaming.eyebrow') }}</div>
      <h2>{{ tx('gaming.title') }}</h2>
      <p>{{ tx('gaming.hint') }}</p>
    </header>
    <div class="panel-body"><GamingContent /></div>
  </section>
</template>
