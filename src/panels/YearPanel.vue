<script setup lang="ts">
import { tx } from '../composables/useTexts'
import YearContent from '@/components/content/YearContent.vue'
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('year.eyebrow') }}</div>
      <h2>{{ tx('year.title') }}</h2>
      <p>{{ tx('year.hint') }}</p>
    </header>
    <div class="panel-body"><YearContent /></div>
  </section>
</template>
