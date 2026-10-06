<script setup lang="ts">
import { tx } from '@/composables/site/useTexts'
import JapanContent from '@/components/japan/JapanContent.vue'
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('japan.eyebrow') }}</div>
      <h2>{{ tx('japan.title') }}</h2>
      <p>{{ tx('japan.hint') }}</p>
    </header>
    <div class="panel-body"><JapanContent /></div>
  </section>
</template>
