<script setup>
import { tx } from '../composables/useTexts'
import JapanContent from '../components/JapanContent.vue'
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
