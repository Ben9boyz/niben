<script setup>
import { tx } from '../composables/useTexts'
import DiscoverContent from '../components/DiscoverContent.vue'
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('discover.eyebrow') }}</div>
      <h2>{{ tx('discover.title') }}</h2>
      <p>{{ tx('discover.hint') }}</p>
    </header>
    <div class="panel-body"><DiscoverContent /></div>
  </section>
</template>
