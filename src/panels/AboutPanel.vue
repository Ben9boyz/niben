<script setup lang="ts">
import { tx } from '../composables/useTexts'
import AboutContent from '@/components/content/AboutContent.vue'
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('about.eyebrow') }}</div>
      <h2>{{ tx('about.title') }}</h2>
    </header>
    <div class="panel-body"><AboutContent compact /></div>
  </section>
</template>
